import type { RecipeResponse, ServerProgressEvent } from "@shared/api/types";
import { ServerProgressEventType, validateServerProgressEvent } from "@shared/api/types";

/**
 * SSE event data prefix pattern.
 */
const SSE_DATA_PREFIX = "data: ";

/**
 * Length of SSE data prefix string (for slicing JSON data from event line).
 */
const SSE_DATA_PREFIX_LENGTH = SSE_DATA_PREFIX.length;

/**
 * Options for parsing SSE stream.
 */
export type ParseSseStreamOptions = {
	/**
	 * The ReadableStreamDefaultReader to read from.
	 */
	reader: ReadableStreamDefaultReader<Uint8Array>;
	/**
	 * TextDecoder instance for decoding stream chunks.
	 */
	decoder: TextDecoder;
	/**
	 * Accumulated buffer for incomplete lines.
	 */
	buffer: string;
	/**
	 * Progress callbacks for UI updates.
	 */
	callbacks: import("./types").ProgressCallbacks;
};

/**
 * Parses SSE events from a stream reader and processes them.
 *
 * Recursively reads from the stream until a terminal event (complete or error)
 * is received or the stream ends unexpectedly.
 *
 * @param options - Options for parsing the SSE stream
 * @returns Promise that resolves with the final RecipeResponse
 */
export async function parseSseStream(options: ParseSseStreamOptions): Promise<RecipeResponse> {
	const { reader, decoder, buffer, callbacks } = options;
	const { done, value } = await reader.read();

	if (done) {
		return {
			success: false,
			error: "Stream ended unexpectedly",
		};
	}

	const newBuffer = buffer + decoder.decode(value, { stream: true });
	const lines = newBuffer.split("\n");
	const remainingBuffer = lines.pop() || "";

	for (const line of lines) {
		if (line.startsWith(SSE_DATA_PREFIX)) {
			try {
				const parsed = JSON.parse(line.slice(SSE_DATA_PREFIX_LENGTH));
				const data = validateServerProgressEvent(parsed);

				if (!data) {
					continue;
				}

				const result = handleSseEvent(data, callbacks);
				if (result) {
					// Terminal event received - return the result
					return result;
				}
			} catch (error) {
				// Skip malformed SSE lines, but log for debugging
				// Always log these as they may indicate protocol issues
				console.warn("Failed to parse SSE event:", error, "Line:", line);
			}
		}
	}

	// Continue reading from stream
	return parseSseStream({
		reader,
		decoder,
		buffer: remainingBuffer,
		callbacks,
	});
}

/**
 * Handles a parsed SSE event and calls appropriate callbacks.
 *
 * @param data - The validated server progress event
 * @param callbacks - Progress callbacks for UI updates
 * @returns RecipeResponse if this was a terminal event, null otherwise
 */
export function handleSseEvent(
	data: ServerProgressEvent,
	callbacks: import("./types").ProgressCallbacks,
): RecipeResponse | null {
	if (data.type === ServerProgressEventType.Progress) {
		callbacks.onProgress(data.message);
		return null;
	}

	if (data.type === ServerProgressEventType.Complete) {
		// Only call onComplete if recipe and tags are present
		if (data.recipe && data.tags) {
			callbacks.onComplete({
				pageId: data.pageId,
				notionUrl: data.notionUrl,
				recipe: {
					name: data.recipe.name,
					author: data.recipe.author,
					ingredients: data.recipe.ingredients,
					instructions: data.recipe.instructions,
				},
				tags: {
					tags: data.tags.tags,
					mealType: data.tags.mealType,
					healthScore: data.tags.healthScore,
					totalTimeMinutes: data.tags.totalTimeMinutes,
				},
			});
		}

		return {
			success: true,
			pageId: data.pageId,
			notionUrl: data.notionUrl,
		};
	}

	if (data.type === ServerProgressEventType.Error) {
		callbacks.onError(data.error || "Unknown error", data.notionUrl);
		return {
			success: false,
			error: data.error || "Unknown error",
			notionUrl: data.notionUrl,
		};
	}

	return null;
}
