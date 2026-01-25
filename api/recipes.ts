/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */

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
 * Handles CORS headers for browser extension requests.
 */
function setCorsHeaders(response: Response): void {
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.headers.set("Access-Control-Expose-Headers", "*");
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
 * Handles recipe processing requests with Server-Sent Events for progress.
 */
function handleRecipeStream(url: string): Response {
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
				/**
				 * Send initial progress event immediately so extension knows connection is working.
				 */
				sendEvent({
					type: ServerProgressEventType.Progress,
					message: "Starting...",
					progressType: "starting",
				});

				/**
				 * Lazy load modules to avoid initialization issues.
				 */
				const { processRecipe } = await import("../src/index.js");
				const { createCliLogger, printRecipeSummary } = await import("../src/logger.js");
				const { getNotionPageUrl } = await import("../src/notion.js");

				const logger = createCliLogger();

				/**
				 * Process with progress callbacks (for SSE) and logger (for server console).
				 */
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
				/**
				 * Log full error details for debugging.
				 */
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

				/**
				 * Extract error message, handling various error types.
				 */
				let errorMessage: string;
				if (error instanceof Error) {
					errorMessage = error.message || error.name || "Unknown error";
				} else if (typeof error === "object" && error !== null) {
					/**
					 * Try to extract meaningful error info from object.
					 */
					const errorObj = error as Record<string, unknown>;
					errorMessage =
						(typeof errorObj.message === "string" && errorObj.message) ||
						(typeof errorObj.error === "string" && errorObj.error) ||
						JSON.stringify(error).substring(0, 200);
				} else {
					errorMessage = String(error);
				}

				const isDuplicate = errorMessage.includes("Duplicate recipe found");

				let notionUrl: string | undefined;
				if (isDuplicate) {
					const urlMatch = errorMessage.match(/View it at: (https:\/\/www\.notion\.so\/[^\s]+)/);
					if (urlMatch) {
						notionUrl = urlMatch[1];
					}
				}

				try {
					sendEvent({
						type: ServerProgressEventType.Error,
						success: false,
						error: errorMessage,
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
 * Handles errors from recipe processing and returns appropriate response.
 */
function handleRecipeError(error: unknown): Response {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const isDuplicate = errorMessage.includes("Duplicate recipe found");

	let statusCode: number = HttpStatus.InternalServerError;
	if (isDuplicate) {
		/**
		 * Conflict status code.
		 */
		statusCode = HttpStatus.Conflict;
	} else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("403")) {
		/**
		 * Bad Gateway (scraping failure).
		 */
		statusCode = HttpStatus.BadGateway;
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
		/**
		 * Handle CORS preflight immediately without any module dependencies.
		 * This must work even if the module hasn't fully loaded.
		 */
		if (req.method === "OPTIONS") {
			const headers = new Headers();
			headers.set("Access-Control-Allow-Origin", "*");
			headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
			headers.set("Access-Control-Expose-Headers", "*");
			return new Response(null, { status: 204, headers });
		}

		/**
		 * Only allow POST.
		 */
		if (req.method !== "POST") {
			const response = Response.json(
				{ error: "Method not allowed" },
				{ status: HttpStatus.MethodNotAllowed },
			);
			setCorsHeaders(response);
			return response;
		}

		/**
		 * Validate API key authentication.
		 */
		const authHeader = req.headers.get("Authorization");
		const authError = validateApiKeyHeader(authHeader, (error, status) => {
			// Log authentication failures for debugging (without exposing the key)
			console.error(`Authentication failed: ${error}`);
			return createErrorResponse(error, status);
		});
		if (authError) {
			return authError;
		}

		/**
		 * Check Content-Length header to prevent large request body attacks.
		 */
		const contentLength = req.headers.get("Content-Length");
		const sizeError = validateRequestSize(contentLength, MAX_REQUEST_BODY_SIZE, (error, status) => {
			console.error(`Request size validation failed: ${error}`);
			return createErrorResponse(error, status);
		});
		if (sizeError) {
			return sizeError;
		}

		try {
			const body = (await req.json()) as RecipeRequest;

			/**
			 * Validate request.
			 */
			const validationError = validateRecipeRequest(body, (error, status) => {
				console.error(`Request validation failed: ${error}`);
				return createErrorResponse(error, status);
			});
			if (validationError) {
				return validationError;
			}

			/**
			 * Use streaming if requested.
			 */
			if (body.stream) {
				return handleRecipeStream(body.url);
			}

			/**
			 * Process the recipe (non-streaming).
			 * Lazy load modules to avoid initialization issues.
			 */
			const { processRecipe } = await import("../src/index.js");
			const { createCliLogger, printRecipeSummary } = await import("../src/logger.js");
			const { getNotionPageUrl } = await import("../src/notion.js");

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
			/**
			 * Log the error for debugging.
			 */
			console.error("Recipe processing error:", error);
			return handleRecipeError(error);
		}
	},
};
