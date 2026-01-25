/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */
import { type ProgressEvent, processRecipe } from "../src/index.js";
import { createCliLogger, printRecipeSummary } from "../src/logger.js";
import { getNotionPageUrl } from "../src/notion.js";

type RecipeRequest = {
	url: string;
	stream?: boolean;
};

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
 */
function handleOptions(): Response {
	const response = new Response(null, { status: 204 });
	setCorsHeaders(response);
	return response;
}

/**
 * Validates the request body and returns an error response if invalid.
 */
function validateRecipeRequest(body: unknown): Response | null {
	if (!body || typeof body !== "object") {
		return createErrorResponse("Missing request body", 400);
	}

	const request = body as RecipeRequest;
	if (!request.url || typeof request.url !== "string") {
		return createErrorResponse("Missing or invalid 'url' field in request body", 400);
	}

	// Validate URL format
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
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: object) => {
				const message = `data: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			try {
				const logger = createCliLogger();

				// Process with progress callbacks (for SSE) and logger (for server console)
				const result = await processRecipe(
					url,
					(event: ProgressEvent) => {
						sendEvent({
							type: "progress",
							message: event.message,
							progressType: event.type,
						});
					},
					logger,
				);

				// Print recipe summary box (same as CLI)
				printRecipeSummary(result.recipe, result.tags);

				const notionUrl = getNotionPageUrl(result.pageId);
				sendEvent({
					type: "complete",
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
				}

				sendEvent({
					type: "error",
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
 * Handles errors from recipe processing and returns appropriate response.
 */
function handleRecipeError(error: unknown): Response {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const isDuplicate = errorMessage.includes("Duplicate recipe found");

	let statusCode = 500;
	if (isDuplicate) {
		statusCode = 409; // Conflict
	} else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("403")) {
		statusCode = 502; // Bad Gateway (scraping failure)
	}

	// Extract Notion URL from duplicate error message if present
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
export default async function handler(req: Request): Promise<Response> {
	// Handle CORS preflight
	if (req.method === "OPTIONS") {
		return handleOptions();
	}

	// Only allow POST
	if (req.method !== "POST") {
		const response = Response.json({ error: "Method not allowed" }, { status: 405 });
		setCorsHeaders(response);
		return response;
	}

	try {
		const body = (await req.json()) as RecipeRequest;

		// Validate request
		const validationError = validateRecipeRequest(body);
		if (validationError) {
			return validationError;
		}

		// Use streaming if requested
		if (body.stream) {
			return handleRecipeStream(body.url);
		}

		// Process the recipe (non-streaming)
		const logger = createCliLogger();
		const result = await processRecipe(body.url, undefined, logger);

		// Print recipe summary box (same as CLI)
		printRecipeSummary(result.recipe, result.tags);

		const savedNotionUrl = getNotionPageUrl(result.pageId);

		const successResponse: RecipeResponse = {
			success: true,
			pageId: result.pageId,
			notionUrl: savedNotionUrl,
		};

		const response = Response.json(successResponse, { status: 200 });
		setCorsHeaders(response);
		return response;
	} catch (error) {
		return handleRecipeError(error);
	}
}
