/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */

import { consola } from "consola";
import { ProgressType } from "../src/index.js";
import { checkRateLimit, getClientIdentifier } from "../src/rate-limit.js";
import {
	MAX_REQUEST_BODY_SIZE,
	type RecipeRequest,
	validateApiKeyHeader,
	validateRecipeRequest,
	validateRequestSize,
} from "../src/security.js";
import {
	createErrorResponse,
	DEFAULT_RATE_LIMIT_VALUE,
	generateRequestId,
	HttpStatus,
	handleRecipeError,
	RATE_LIMIT_HEADERS,
	type RecipeResponse,
	sanitizeError,
	setCorsHeaders,
	setSecurityHeaders,
} from "../src/server-shared.js";
import { ServerProgressEventType } from "../src/shared/api.js";

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 *
 * Streams progress updates to the client as the recipe is processed. Encodes events
 * as SSE format and handles errors gracefully by sending error events through the stream.
 *
 * @param url - The recipe URL to process.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with SSE stream for progress updates.
 */
function handleRecipeStream(url: string, requestId?: string): Response {
	const stream = new ReadableStream({
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
					progressType: ProgressType.Starting,
				});

				const { processRecipe } = await import("../src/index.js");
				const { createConsoleLogger } = await import("../src/logger.js");
				const { getNotionPageUrl } = await import("../src/notion.js");

				const logger = createConsoleLogger();

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
				consola.error("Recipe processing error in stream:", error);
				if (error instanceof Error) {
					consola.error("Error name:", error.name);
					consola.error("Error message:", error.message);
					consola.error("Error stack:", error.stack);
					if ("cause" in error && error.cause) {
						consola.error("Error cause:", error.cause);
					}
				} else {
					consola.error("Error type:", typeof error);
					consola.error("Error value:", JSON.stringify(error, null, 2));
				}

				const { message, notionUrl } = sanitizeError(error, { error: consola.error }, requestId);

				try {
					sendEvent({
						type: ServerProgressEventType.Error,
						success: false,
						error: message,
						...(notionUrl && { notionUrl }),
					});
				} catch (e) {
					consola.error("Error sending error event:", e);
				}
			} finally {
				try {
					controller.close();
				} catch (e) {
					consola.error("Error closing stream:", e);
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
			consola.error(`[${requestId}] Authentication failed: ${error}`);
			return createErrorResponse(error, status, false);
		});

		if (authError) {
			return authError;
		}

		const contentLength = req.headers.get("Content-Length");
		const sizeError = validateRequestSize(contentLength, MAX_REQUEST_BODY_SIZE, (error, status) => {
			consola.error(`[${requestId}] Request size validation failed: ${error}`);
			return createErrorResponse(error, status, false);
		});

		if (sizeError) {
			return sizeError;
		}

		try {
			const body = (await req.json()) as RecipeRequest;

			const validationError = validateRecipeRequest(body, (error, status) => {
				consola.error(`[${requestId}] Request validation failed: ${error}`);
				return createErrorResponse(error, status, false);
			});

			if (validationError) {
				return validationError;
			}

			if (body.stream) {
				return handleRecipeStream(body.url, requestId);
			}

			const { processRecipe } = await import("../src/index.js");
			const { createConsoleLogger } = await import("../src/logger.js");
			const { getNotionPageUrl } = await import("../src/notion.js");

			const logger = createConsoleLogger();
			const result = await processRecipe(body.url, undefined, logger);

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
			consola.error("Recipe processing error:", error);
			return handleRecipeError(error, { error: consola.error }, requestId);
		}
	},
};
