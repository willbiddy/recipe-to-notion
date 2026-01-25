import { consola } from "consola";
import { type ProgressEvent, processRecipe } from "./index.js";
import { createCliLogger, printRecipeSummary } from "./logger.js";
import { getNotionPageUrl } from "./notion.js";
import { checkRateLimit, getClientIdentifier } from "./rate-limit.js";
import {
	MAX_REQUEST_BODY_SIZE,
	type RecipeRequest,
	validateApiKeyHeader,
	validateRecipeRequest,
	validateRequestSize,
} from "./security.js";
import {
	DEFAULT_RATE_LIMIT_VALUE,
	generateRequestId,
	HttpStatus,
	handleRecipeError,
	RATE_LIMIT_HEADERS,
	type RecipeResponse,
	sanitizeError,
	setCorsHeaders,
	setSecurityHeaders,
} from "./server-shared.js";
import { ServerProgressEventType } from "./shared/api.js";

/**
 * Handles OPTIONS preflight requests for CORS.
 *
 * @returns Response with CORS headers and 204 No Content status.
 */
function handleOptions(): Response {
	const response = new Response(null, { status: HttpStatus.NoContent });
	setCorsHeaders(response);
	return response;
}

/**
 * Handles health check requests.
 *
 * @returns Response with health status and CORS headers.
 */
function handleHealth(): Response {
	const response = Response.json({ status: "ok", service: "recipe-to-notion" });
	setCorsHeaders(response);
	return response;
}

/**
 * Logs incoming requests with correlation ID.
 *
 * Only logs non-health-check requests to reduce noise.
 *
 * @param request - The incoming HTTP request to log.
 * @param requestId - Optional request correlation ID.
 */
function logRequest(request: Request, requestId?: string): void {
	const url = new URL(request.url);

	if (url.pathname !== "/health") {
		const idPrefix = requestId ? `[${requestId}]` : "";
		consola.info(`${idPrefix} ${request.method} ${url.pathname}`);
	}
}

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 *
 * Streams progress updates to the client as the recipe is processed.
 *
 * @param _request - The incoming request (unused, but required for signature).
 * @param url - The recipe URL to process.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with SSE stream for progress updates.
 */
function handleRecipeStream(_request: Request, url: string, requestId?: string): Response {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: object) => {
				const message = `data: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			try {
				const logger = createCliLogger();

				const result = await processRecipe(
					url,
					(event: ProgressEvent) => {
						sendEvent({
							type: ServerProgressEventType.Progress,
							message: event.message,
							progressType: event.type,
						});
					},
					logger,
				);

				printRecipeSummary(result.recipe, result.tags);

				const notionUrl = getNotionPageUrl(result.pageId);
				sendEvent({
					type: ServerProgressEventType.Complete,
					success: true,
					pageId: result.pageId,
					notionUrl,
				});
			} catch (error) {
				const { message, notionUrl } = sanitizeError(error, { error: consola.error }, requestId);

				sendEvent({
					type: ServerProgressEventType.Error,
					success: false,
					error: message,
					...(notionUrl && { notionUrl }),
				});
			} finally {
				controller.close();
			}
		},
	});

	const response = new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
	setCorsHeaders(response);
	return response;
}

/**
 * Creates an error response with CORS headers.
 *
 * @param error - The error message to include in the response.
 * @param status - The HTTP status code for the error.
 * @returns Response with error details and CORS headers.
 */
function createErrorResponse(error: string, status: number): Response {
	const errorResponse: RecipeResponse = {
		success: false,
		error,
	};
	const response = Response.json(errorResponse, { status });
	setSecurityHeaders(response);
	setCorsHeaders(response);
	return response;
}

/**
 * Handles recipe processing requests (non-streaming, for backwards compatibility).
 *
 * Validates rate limit, authentication, request size, and URL before processing.
 * Supports both streaming and non-streaming responses based on the request body.
 *
 * @param request - The incoming HTTP request.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with recipe processing result or error.
 */
async function handleRecipe(request: Request, requestId?: string): Promise<Response> {
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(clientId);

	if (!rateLimit.allowed) {
		const response = Response.json(
			{
				success: false,
				error: "Rate limit exceeded. Please try again later.",
			},
			{
				status: 429,
				headers: {
					[RATE_LIMIT_HEADERS.LIMIT]: String(DEFAULT_RATE_LIMIT_VALUE),
					[RATE_LIMIT_HEADERS.REMAINING]: "0",
					[RATE_LIMIT_HEADERS.RESET]: new Date(rateLimit.resetAt).toISOString(),
				},
			},
		);
		setSecurityHeaders(response);
		setCorsHeaders(response);
		return response;
	}

	const authError = validateApiKeyHeader(request.headers.get("Authorization"), (error, status) => {
		const response = Response.json({ success: false, error }, { status });
		setSecurityHeaders(response);
		setCorsHeaders(response);
		return response;
	});

	if (authError) {
		return authError;
	}

	const sizeError = validateRequestSize(
		request.headers.get("Content-Length"),
		MAX_REQUEST_BODY_SIZE,
		(error, status) => createErrorResponse(error, status),
	);

	if (sizeError) {
		return sizeError;
	}

	try {
		const body = (await request.json()) as RecipeRequest;

		const validationError = validateRecipeRequest(body, (error, status) =>
			createErrorResponse(error, status),
		);
		if (validationError) {
			return validationError;
		}

		if (body.stream) {
			return handleRecipeStream(request, body.url, requestId);
		}

		const logger = createCliLogger();
		const result = await processRecipe(body.url, undefined, logger);

		printRecipeSummary(result.recipe, result.tags);

		const savedNotionUrl = getNotionPageUrl(result.pageId);

		const successResponse: RecipeResponse = {
			success: true,
			pageId: result.pageId,
			notionUrl: savedNotionUrl,
		};

		const response = Response.json(successResponse, {
			status: HttpStatus.OK,
			headers: {
				[RATE_LIMIT_HEADERS.LIMIT]: String(DEFAULT_RATE_LIMIT_VALUE),
				[RATE_LIMIT_HEADERS.REMAINING]: rateLimit.remaining.toString(),
				[RATE_LIMIT_HEADERS.RESET]: new Date(rateLimit.resetAt).toISOString(),
			},
		});
		setSecurityHeaders(response);
		setCorsHeaders(response);
		return response;
	} catch (error) {
		return handleRecipeError(error, { error: consola.error }, requestId);
	}
}

/**
 * Main request handler for the HTTP server.
 *
 * Routes requests to appropriate handlers based on path and method.
 * Handles CORS, health checks, and recipe processing.
 *
 * @param request - The incoming HTTP request.
 * @returns Response for the request.
 */
export async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const requestId = generateRequestId();

	logRequest(request, requestId);

	if (request.method === "OPTIONS") {
		return handleOptions();
	}

	if (url.pathname === "/health" && request.method === "GET") {
		return handleHealth();
	}

	if (url.pathname === "/api/recipes" && request.method === "POST") {
		return await handleRecipe(request, requestId);
	}

	const response = Response.json({ error: "Not found" }, { status: HttpStatus.NotFound });
	setCorsHeaders(response);
	return response;
}
