/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */

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
 * Request body format for the /api/recipes endpoint.
 */
type RecipeRequest = {
	/**
	 * Recipe URL to process.
	 */
	url: string;
	/**
	 * If true, use SSE for progress updates.
	 */
	stream?: boolean;
};

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
	response.headers.set("Access-Control-Allow-Headers", "Content-Type");
	response.headers.set("Access-Control-Expose-Headers", "*");
}

/**
 * Handles OPTIONS preflight requests.
 * This must work without any module imports to avoid initialization issues.
 */
function handleOptions(): Response {
	const headers = new Headers();
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type");
	headers.set("Access-Control-Expose-Headers", "*");
	return new Response(null, { status: HttpStatus.NoContent, headers });
}

/**
 * Validates the request body and returns an error response if invalid.
 */
function validateRecipeRequest(body: unknown): Response | null {
	if (!body || typeof body !== "object") {
		return createErrorResponse("Missing request body", HttpStatus.BadRequest);
	}

	const request = body as RecipeRequest;
	if (!request.url || typeof request.url !== "string") {
		return createErrorResponse(
			"Missing or invalid 'url' field in request body",
			HttpStatus.BadRequest,
		);
	}

	/**
	 * Validate URL format.
	 */
	try {
		new URL(request.url);
	} catch {
		return createErrorResponse("Invalid URL format", 400);
	}

	return null;
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
					type: "progress",
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
							type: "progress",
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
					type: "complete",
					success: true,
					pageId: result.pageId,
					notionUrl,
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
						type: "error",
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
			headers.set("Access-Control-Allow-Headers", "Content-Type");
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

		try {
			const body = (await req.json()) as RecipeRequest;

			/**
			 * Validate request.
			 */
			const validationError = validateRecipeRequest(body);
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
