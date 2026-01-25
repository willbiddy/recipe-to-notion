import { consola } from "consola";
import { type ProgressEvent, processRecipe } from "./index.js";
import { createCliLogger, printRecipeSummary } from "./logger.js";
import { getNotionPageUrl } from "./notion.js";
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
 * Handles CORS headers for browser extension requests.
 *
 * Includes headers for Server-Sent Events (SSE) support.
 */
function setCorsHeaders(response: Response): void {
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	/**
	 * For SSE.
	 */
	response.headers.set("Access-Control-Expose-Headers", "*");
}

/**
 * Handles OPTIONS preflight requests.
 */
function handleOptions(): Response {
	const response = new Response(null, { status: HttpStatus.NoContent });
	setCorsHeaders(response);
	return response;
}

/**
 * Handles health check requests.
 */
function handleHealth(): Response {
	const response = Response.json({ status: "ok", service: "recipe-to-notion" });
	setCorsHeaders(response);
	return response;
}

/**
 * Logs incoming requests.
 *
 * Only logs non-health-check requests.
 */
function logRequest(request: Request): void {
	const url = new URL(request.url);
	if (url.pathname !== "/health") {
		consola.info(`${request.method} ${url.pathname}`);
	}
}

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 */
function handleRecipeStream(_request: Request, url: string): Response {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: object) => {
				const message = `data: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			try {
				const logger = createCliLogger();

				/**
				 * Process with progress callbacks (for SSE) and logger (for server console).
				 */
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

				/**
				 * Print recipe summary box (same as CLI).
				 */
				printRecipeSummary(result.recipe, result.tags);

				const notionUrl = getNotionPageUrl(result.pageId);
				sendEvent({
					type: ServerProgressEventType.Complete,
					success: true,
					pageId: result.pageId,
					notionUrl,
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const isDuplicate = errorMessage.includes("Duplicate recipe found");

				let notionUrl: string | undefined;
				if (isDuplicate) {
					const urlMatch = errorMessage.match(/View it at: (https:\/\/www\.notion\.so\/[^\s]+)/);
					if (urlMatch) {
						notionUrl = urlMatch[1];
					}
					/**
					 * Logger already handled the duplicate warning via onDuplicateFound.
					 */
				} else {
					/**
					 * For non-duplicate errors, log them.
					 */
					consola.error(`Failed: ${errorMessage}`);
				}

				sendEvent({
					type: ServerProgressEventType.Error,
					success: false,
					error: errorMessage,
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
 */
function createErrorResponse(error: string, status: number): Response {
	const errorResponse: RecipeResponse = {
		success: false,
		error,
	};
	const response = Response.json(errorResponse, { status });
	setCorsHeaders(response);
	return response;
}

/**
 * Handles errors from recipe processing and returns appropriate response.
 */
function handleRecipeError(error: unknown): Response {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const isDuplicate = errorMessage.includes("Duplicate recipe found");

	let statusCode = HttpStatus.InternalServerError;
	if (isDuplicate) {
		/**
		 * Conflict status code.
		 * Logger already handled the duplicate warning via onDuplicateFound.
		 */
		statusCode = HttpStatus.Conflict;
	} else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("403")) {
		/**
		 * Bad Gateway (scraping failure).
		 */
		statusCode = HttpStatus.BadGateway;
		consola.error(`Failed: ${errorMessage}`);
	} else {
		consola.error(`Failed: ${errorMessage}`);
	}

	/**
	 * Extract Notion URL from duplicate error message if present.
	 */
	let notionUrl: string | undefined;
	if (isDuplicate) {
		const urlMatch = errorMessage.match(/View it at: (https:\/\/www\.notion\.so\/[^\s]+)/);
		if (urlMatch) {
			notionUrl = urlMatch[1];
		}
	}

	const errorResponse: RecipeResponse = {
		success: false,
		error: errorMessage,
		...(notionUrl && { notionUrl }),
	};

	const response = Response.json(errorResponse, { status: statusCode });
	setCorsHeaders(response);
	return response;
}

/**
 * Handles recipe processing requests (non-streaming, for backwards compatibility).
 */
async function handleRecipe(request: Request): Promise<Response> {
	/**
	 * Validate API key authentication.
	 */
	const authError = validateApiKeyHeader(request.headers.get("Authorization"), (error, status) => {
		const response = Response.json({ success: false, error }, { status });
		setCorsHeaders(response);
		return response;
	});
	if (authError) {
		return authError;
	}

	/**
	 * Check Content-Length header to prevent large request body attacks.
	 */
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

		/**
		 * Validate request.
		 */
		const validationError = validateRecipeRequest(body, (error, status) =>
			createErrorResponse(error, status),
		);
		if (validationError) {
			return validationError;
		}

		/**
		 * Use streaming if requested.
		 */
		if (body.stream) {
			return handleRecipeStream(request, body.url);
		}

		/**
		 * Process the recipe (non-streaming).
		 */
		const logger = createCliLogger();
		const result = await processRecipe(body.url, undefined, logger);

		/**
		 * Print recipe summary box (same as CLI).
		 */
		printRecipeSummary(result.recipe, result.tags);

		const savedNotionUrl = getNotionPageUrl(result.pageId);

		const successResponse: RecipeResponse = {
			success: true,
			pageId: result.pageId,
			notionUrl: savedNotionUrl,
		};

		const response = Response.json(successResponse, { status: HttpStatus.OK });
		setCorsHeaders(response);
		return response;
	} catch (error) {
		return handleRecipeError(error);
	}
}

/**
 * Main request handler for the HTTP server.
 */
export async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);

	/**
	 * Log incoming requests (except health checks).
	 */
	logRequest(request);

	/**
	 * Handle CORS preflight.
	 */
	if (request.method === "OPTIONS") {
		return handleOptions();
	}

	/**
	 * Health check endpoint.
	 */
	if (url.pathname === "/health" && request.method === "GET") {
		return handleHealth();
	}

	/**
	 * Recipe processing endpoint.
	 */
	if (url.pathname === "/api/recipes" && request.method === "POST") {
		return await handleRecipe(request);
	}

	/**
	 * 404 for unknown routes.
	 */
	const response = Response.json({ error: "Not found" }, { status: HttpStatus.NotFound });
	setCorsHeaders(response);
	return response;
}
