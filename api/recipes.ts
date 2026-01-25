/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */

import { checkRateLimit, getClientIdentifier } from "../src/rate-limit.js";
import {
	MAX_REQUEST_BODY_SIZE,
	type RecipeRequest,
	validateApiKeyHeader,
	validateRecipeRequest,
	validateRequestSize,
} from "../src/security.js";
import { ServerProgressEventType } from "../src/shared/api.js";

/**
 * HTTP status codes used throughout the API.
 */
const HttpStatus = {
	OK: 200,
	NoContent: 204,
	BadRequest: 400,
	NotFound: 404,
	MethodNotAllowed: 405,
	Conflict: 409,
	InternalServerError: 500,
	BadGateway: 502,
} as const;

/**
 * Response format for the /api/recipes endpoint.
 */
type RecipeResponse = {
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
	setCorsHeaders(response);
	return response;
}

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 *
 * Streams progress updates to the client as the recipe is processed.
 *
 * @param url - The recipe URL to process.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with SSE stream for progress updates.
 */
function handleRecipeStream(url: string, requestId?: string): Response {
	const stream = new ReadableStream({
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE stream handling is inherently complex
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: object) => {
				try {
					const message = `data: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (e) {
					console.error("Error sending SSE event:", e);
				}
			};

			try {
				sendEvent({
					type: ServerProgressEventType.Progress,
					message: "Starting...",
					progressType: "starting",
				});

				const { processRecipe } = await import("../src/index.js");
				const { createCliLogger, printRecipeSummary } = await import("../src/logger.js");
				const { getNotionPageUrl } = await import("../src/notion.js");

				const logger = createCliLogger();

				const result = await processRecipe(
					url,
					(event) => {
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
					recipe: {
						name: result.recipe.name,
						author: result.recipe.author,
						ingredients: result.recipe.ingredients,
						instructions: result.recipe.instructions,
					},
					tags: {
						tags: result.tags.tags,
						mealType: result.tags.mealType,
						healthiness: result.tags.healthiness,
						totalTimeMinutes: result.tags.totalTimeMinutes,
					},
				});
			} catch (error) {
				console.error("Recipe processing error in stream:", error);
				if (error instanceof Error) {
					console.error("Error name:", error.name);
					console.error("Error message:", error.message);
					console.error("Error stack:", error.stack);
					if ("cause" in error && error.cause) {
						console.error("Error cause:", error.cause);
					}
				} else {
					console.error("Error type:", typeof error);
					console.error("Error value:", JSON.stringify(error, null, 2));
				}

				const { message, notionUrl } = sanitizeError(error, requestId);

				try {
					sendEvent({
						type: ServerProgressEventType.Error,
						success: false,
						error: message,
						...(notionUrl && { notionUrl }),
					});
				} catch (e) {
					console.error("Error sending error event:", e);
				}
			} finally {
				try {
					controller.close();
				} catch (e) {
					console.error("Error closing stream:", e);
				}
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
 * Pattern to extract Notion URL from duplicate error messages.
 */
const NOTION_URL_EXTRACTION_PATTERN = /View it at: (https:\/\/www\.notion\.so\/[^\s]+)/;

/**
 * Rate limit header names for responses.
 */
const RATE_LIMIT_HEADERS = {
	LIMIT: "X-RateLimit-Limit",
	REMAINING: "X-RateLimit-Remaining",
	RESET: "X-RateLimit-Reset",
} as const;

/**
 * Default rate limit value (requests per minute).
 */
const DEFAULT_RATE_LIMIT_VALUE = 10;

/**
 * Generates a unique request correlation ID.
 *
 * @returns A unique request ID string.
 */
function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
	console.error(`${logPrefix} Recipe processing error:`, {
		message: errorMessage,
		stack: fullError.stack,
		name: fullError.name,
	});

	let statusCode: number = HttpStatus.InternalServerError;
	let clientMessage: string;
	let notionUrl: string | undefined;

	if (isDuplicate) {
		statusCode = HttpStatus.Conflict;
		// Duplicate errors are safe to return as-is (user-friendly)
		clientMessage = errorMessage;
		const urlMatch = errorMessage.match(NOTION_URL_EXTRACTION_PATTERN);
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
	setCorsHeaders(response);
	return response;
}

/**
 * Main handler for the /api/recipes endpoint.
 */
export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with recipe processing result or error.
	 */
	async fetch(req: Request): Promise<Response> {
		const requestId = generateRequestId();

		if (req.method === "OPTIONS") {
			const headers = new Headers();
			headers.set("X-Content-Type-Options", "nosniff");
			headers.set("X-Frame-Options", "DENY");
			headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
			headers.set("Access-Control-Allow-Origin", "*");
			headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
			headers.set("Access-Control-Expose-Headers", "*");
			headers.set("Access-Control-Allow-Credentials", "false");
			return new Response(null, { status: 204, headers });
		}

		if (req.method !== "POST") {
			const response = Response.json(
				{ error: "Method not allowed" },
				{ status: HttpStatus.MethodNotAllowed },
			);
			setSecurityHeaders(response);
			setCorsHeaders(response);
			return response;
		}

		// Check rate limit before processing
		const clientId = getClientIdentifier(req);
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

		const authHeader = req.headers.get("Authorization");
		const authError = validateApiKeyHeader(authHeader, (error, status) => {
			console.error(`[${requestId}] Authentication failed: ${error}`);
			return createErrorResponse(error, status);
		});
		if (authError) {
			return authError;
		}

		const contentLength = req.headers.get("Content-Length");
		const sizeError = validateRequestSize(contentLength, MAX_REQUEST_BODY_SIZE, (error, status) => {
			console.error(`[${requestId}] Request size validation failed: ${error}`);
			return createErrorResponse(error, status);
		});
		if (sizeError) {
			return sizeError;
		}

		try {
			const body = (await req.json()) as RecipeRequest;

			const validationError = validateRecipeRequest(body, (error, status) => {
				console.error(`[${requestId}] Request validation failed: ${error}`);
				return createErrorResponse(error, status);
			});
			if (validationError) {
				return validationError;
			}

			if (body.stream) {
				return handleRecipeStream(body.url, requestId);
			}

			const { processRecipe } = await import("../src/index.js");
			const { createCliLogger, printRecipeSummary } = await import("../src/logger.js");
			const { getNotionPageUrl } = await import("../src/notion.js");

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
			console.error("Recipe processing error:", error);
			return handleRecipeError(error, requestId);
		}
	},
};
