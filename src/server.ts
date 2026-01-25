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
import { ServerProgressEventType } from "./shared/api.js";

/**
 * HTTP status codes used throughout the server.
 */
enum HttpStatus {
	OK = 200,
	NoContent = 204,
	BadRequest = 400,
	NotFound = 404,
	MethodNotAllowed = 405,
	Conflict = 409,
	InternalServerError = 500,
	BadGateway = 502,
}

/**
 * Response format for the /api/recipes endpoint.
 */
export type RecipeResponse = {
	success: boolean;
	pageId?: string;
	notionUrl?: string;
	error?: string;
};

/**
 * Sets security headers on responses.
 *
 * @param response - The response object to add security headers to.
 */
function setSecurityHeaders(response: Response): void {
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}

/**
 * Handles CORS headers for browser extension requests.
 *
 * Includes headers for Server-Sent Events (SSE) support.
 *
 * @param response - The response object to add CORS headers to.
 */
function setCorsHeaders(response: Response): void {
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.headers.set("Access-Control-Expose-Headers", "*");
	response.headers.set("Access-Control-Allow-Credentials", "false");
}

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
 * Generates a unique request correlation ID.
 *
 * @returns A unique request ID string.
 */
function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
				const { message, notionUrl } = sanitizeError(error, requestId);

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
 * Sanitizes error messages for client responses.
 * Logs detailed errors server-side but returns generic messages to clients.
 *
 * @param error - The error that occurred.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Sanitized error message for client and extracted Notion URL if duplicate.
 */
function sanitizeError(
	error: unknown,
	requestId?: string,
): { message: string; notionUrl?: string; statusCode: number } {
	const fullError = error instanceof Error ? error : new Error(String(error));
	const errorMessage = fullError.message;
	const isDuplicate = errorMessage.includes("Duplicate recipe found");

	// Log detailed error server-side
	const logPrefix = requestId ? `[${requestId}]` : "";
	consola.error(`${logPrefix} Recipe processing error:`, {
		message: errorMessage,
		stack: fullError.stack,
		name: fullError.name,
	});

	let statusCode = HttpStatus.InternalServerError;
	let clientMessage: string;
	let notionUrl: string | undefined;

	if (isDuplicate) {
		statusCode = HttpStatus.Conflict;
		// Duplicate errors are safe to return as-is (user-friendly)
		clientMessage = errorMessage;
		const urlMatch = errorMessage.match(/View it at: (https:\/\/www\.notion\.so\/[^\s]+)/);
		if (urlMatch) {
			notionUrl = urlMatch[1];
		}
	} else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("403")) {
		statusCode = HttpStatus.BadGateway;
		// Network errors: return generic message but keep some context
		if (errorMessage.includes("403")) {
			clientMessage =
				"The recipe site blocked the request. Try saving the page source and using the --html option.";
		} else if (errorMessage.includes("timeout")) {
			clientMessage = "Request timed out. The recipe site may be slow or unresponsive.";
		} else {
			clientMessage =
				"Failed to fetch the recipe page. The site may be unavailable or blocking requests.";
		}
	} else if (errorMessage.includes("Invalid URL") || errorMessage.includes("URL")) {
		statusCode = HttpStatus.BadRequest;
		// URL validation errors are safe to return
		clientMessage = errorMessage;
	} else {
		// Generic internal errors: don't expose details
		clientMessage = "An error occurred while processing the recipe. Please try again.";
	}

	return { message: clientMessage, notionUrl, statusCode };
}

/**
 * Handles errors from recipe processing and returns appropriate response.
 *
 * Determines the correct HTTP status code based on error type (duplicate, scraping failure, etc.)
 * and extracts Notion URL from duplicate error messages.
 *
 * @param error - The error that occurred during recipe processing.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with appropriate status code and error details.
 */
function handleRecipeError(error: unknown, requestId?: string): Response {
	const { message, notionUrl, statusCode } = sanitizeError(error, requestId);

	const errorResponse: RecipeResponse = {
		success: false,
		error: message,
		...(notionUrl && { notionUrl }),
	};

	const response = Response.json(errorResponse, { status: statusCode });
	setSecurityHeaders(response);
	setCorsHeaders(response);
	return response;
}

/**
 * Handles recipe processing requests (non-streaming, for backwards compatibility).
 *
 * Validates authentication, request size, and URL before processing.
 * Supports both streaming and non-streaming responses.
 *
 * @param request - The incoming HTTP request.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with recipe processing result or error.
 */
async function handleRecipe(request: Request, requestId?: string): Promise<Response> {
	// Check rate limit before processing
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
					"X-RateLimit-Limit": "10",
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
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
				"X-RateLimit-Limit": "10",
				"X-RateLimit-Remaining": rateLimit.remaining.toString(),
				"X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
			},
		});
		setSecurityHeaders(response);
		setCorsHeaders(response);
		return response;
	} catch (error) {
		return handleRecipeError(error, requestId);
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
