import { consola } from "consola";
import { getNotionPageUrl } from "./notion.js";
import { processRecipe, type ProgressEvent } from "./index.js";

/**
 * Response format for the /api/recipes endpoint.
 */
export interface RecipeResponse {
	success: boolean;
	pageId?: string;
	notionUrl?: string;
	error?: string;
}

/**
 * Request body format for the /api/recipes endpoint.
 */
interface RecipeRequest {
	url: string;
	stream?: boolean; // If true, use SSE for progress updates
}

/**
 * Handles CORS headers for browser extension requests.
 */
function setCorsHeaders(response: Response): void {
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type");
	// For SSE
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
 * Handles health check requests.
 */
function handleHealth(): Response {
	const response = Response.json({ status: "ok", service: "recipe-to-notion" });
	setCorsHeaders(response);
	return response;
}

/**
 * Logs incoming requests.
 */
function logRequest(request: Request): void {
	const url = new URL(request.url);
	if (url.pathname !== "/health") {
		// Only log non-health-check requests
		consola.info(`${request.method} ${url.pathname}`);
	}
}

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 */
async function handleRecipeStream(request: Request, url: string): Promise<Response> {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: object) => {
				const message = `data: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			try {
				consola.info(`Processing recipe: ${url}`);
				
				// Process with progress callbacks
				const result = await processRecipe(url, (event: ProgressEvent) => {
					consola.start(event.message);
					sendEvent({
						type: "progress",
						message: event.message,
						progressType: event.type,
					});
				});

				const notionUrl = getNotionPageUrl(result.pageId);
				consola.success(`Recipe saved: ${result.recipe.name} → ${notionUrl}`);
				
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
					const urlMatch = errorMessage.match(
						/View it at: (https:\/\/www\.notion\.so\/[^\s]+)/,
					);
					if (urlMatch) {
						notionUrl = urlMatch[1];
					}
					consola.warn(`Duplicate recipe: ${url}`);
				} else {
					consola.error(`Failed to process recipe: ${errorMessage}`);
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
 * Handles recipe processing requests (non-streaming, for backwards compatibility).
 */
async function handleRecipe(request: Request): Promise<Response> {
	try {
		const body = (await request.json()) as RecipeRequest;

		if (!body.url || typeof body.url !== "string") {
			const errorResponse: RecipeResponse = {
				success: false,
				error: "Missing or invalid 'url' field in request body",
			};
			const response = Response.json(errorResponse, { status: 400 });
			setCorsHeaders(response);
			return response;
		}

		// Validate URL format
		try {
			new URL(body.url);
		} catch {
			const errorResponse: RecipeResponse = {
				success: false,
				error: "Invalid URL format",
			};
			const response = Response.json(errorResponse, { status: 400 });
			setCorsHeaders(response);
			return response;
		}

		// Use streaming if requested
		if (body.stream) {
			return handleRecipeStream(request, body.url);
		}

		// Process the recipe (non-streaming)
		consola.info(`Processing recipe: ${body.url}`);
		const result = await processRecipe(body.url);
		const notionUrl = getNotionPageUrl(result.pageId);
		consola.success(`Recipe saved: ${result.recipe.name} → ${notionUrl}`);

		const successResponse: RecipeResponse = {
			success: true,
			pageId: result.pageId,
			notionUrl,
		};

		const response = Response.json(successResponse, { status: 200 });
		setCorsHeaders(response);
		return response;
	} catch (error) {
		// Handle duplicate errors specially
		const errorMessage = error instanceof Error ? error.message : String(error);
		const isDuplicate = errorMessage.includes("Duplicate recipe found");

		let statusCode = 500;
		if (isDuplicate) {
			statusCode = 409; // Conflict
			consola.warn(`Duplicate recipe detected`);
		} else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("403")) {
			statusCode = 502; // Bad Gateway (scraping failure)
			consola.error(`Scraping failed: ${errorMessage}`);
		} else {
			consola.error(`Recipe processing failed: ${errorMessage}`);
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
}

/**
 * Main request handler for the HTTP server.
 */
export async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);

	// Log incoming requests (except health checks)
	logRequest(request);

	// Handle CORS preflight
	if (request.method === "OPTIONS") {
		return handleOptions();
	}

	// Health check endpoint
	if (url.pathname === "/health" && request.method === "GET") {
		return handleHealth();
	}

	// Recipe processing endpoint
	if (url.pathname === "/api/recipes" && request.method === "POST") {
		return handleRecipe(request);
	}

	// 404 for unknown routes
	const response = Response.json({ error: "Not found" }, { status: 404 });
	setCorsHeaders(response);
	return response;
}
