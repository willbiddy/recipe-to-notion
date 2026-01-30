/**
 * Server-Sent Events (SSE) streaming for recipe processing progress.
 * Handles real-time progress updates during recipe scraping, tagging, and Notion upload.
 */

import { ServerProgressEventType } from "@shared/api/types";
import { createConsoleLogger } from "../logger";
import { getNotionPageUrl } from "../notion/notion-client";
import { type ProgressEvent, processRecipe } from "../process-recipe";
import { sanitizeError } from "./errors";
import { setCorsHeaders } from "./http-utils";

/**
 * Options for recipe stream handling.
 */
export type HandleRecipeStreamOptions = {
	/**
	 * The recipe URL to process.
	 */
	url: string;
	/**
	 * Optional request correlation ID for logging.
	 */
	requestId?: string;
	/**
	 * Whether to include full recipe and tags data in the complete event (for Vercel API).
	 */
	includeFullData?: boolean;
};

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 *
 * Creates an SSE stream that sends progress updates as the recipe is processed:
 * 1. "progress" events during scraping, AI tagging, and Notion upload
 * 2. "complete" event with success data and optional full recipe/tags
 * 3. "error" event if processing fails
 *
 * The stream automatically closes when processing completes or fails.
 *
 * @param options - Stream handling options including URL and request ID
 * @returns Response with SSE stream for progress updates
 */
export function handleRecipeStream(options: HandleRecipeStreamOptions): Response {
	const { url, requestId, includeFullData = false } = options;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let streamBroken = false;

			/**
			 * Sends an SSE event to the client.
			 * If the stream is broken (controller.enqueue fails), marks it as broken
			 * and subsequent sends will be skipped to avoid filling logs.
			 */
			function sendEvent(data: object): boolean {
				if (streamBroken) {
					return false;
				}

				try {
					const message = `data: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(message));
					return true;
				} catch (e) {
					streamBroken = true;
					console.error("[recipe-streaming] SSE stream broken, cannot send event:", e);
					console.error("[recipe-streaming] Client likely disconnected or stream corrupted");
					return false;
				}
			}

			try {
				const logger = createConsoleLogger();

				// Process recipe with progress callbacks
				const result = await processRecipe({
					url,
					onProgress: (event: ProgressEvent) => {
						sendEvent({
							type: ServerProgressEventType.Progress,
							message: event.message,
							progressType: event.type,
						});
					},
					logger,
				});

				// Build complete event
				const notionUrl = getNotionPageUrl(result.pageId);

				const completeEvent: Record<string, unknown> = {
					type: ServerProgressEventType.Complete,
					success: true,
					pageId: result.pageId,
					notionUrl,
				};

				// Include full data if requested (Vercel API needs this for response)
				if (includeFullData) {
					completeEvent.recipe = {
						name: result.recipe.name,
						author: result.recipe.author,
						ingredients: result.recipe.ingredients,
						instructions: result.recipe.instructions,
					};
					completeEvent.tags = {
						tags: result.tags.tags,
						mealType: result.tags.mealType,
						healthScore: result.tags.healthScore,
						totalTimeMinutes: result.tags.totalTimeMinutes,
					};
				}

				sendEvent(completeEvent);
			} catch (error) {
				console.error("[recipe-streaming] Recipe processing error:", error);

				const { logErrorDetails } = await import("./errors.js");
				logErrorDetails(error, { error: console.error }, requestId);

				const { message, notionUrl } = sanitizeError(error, { error: console.error }, requestId);

				try {
					sendEvent({
						type: ServerProgressEventType.Error,
						success: false,
						error: message,
						...(notionUrl && { notionUrl }),
					});
				} catch (e) {
					console.error("[recipe-streaming] Failed to send error event to client:", e);
					console.error("[recipe-streaming] Original error was:", message);
					// Stream is likely broken; client won't receive error notification
				}
			} finally {
				try {
					controller.close();
				} catch (e) {
					console.error("[recipe-streaming] Error closing SSE stream:", e);
					// Stream may already be closed by client disconnect; this is expected
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
