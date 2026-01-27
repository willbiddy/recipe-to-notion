import type { RecipeResponse, ServerProgressEvent } from "./types.js";
import { ServerProgressEventType } from "./types.js";
import { validateServerProgressEvent } from "./validation.js";

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
	callbacks: import("./types.js").ProgressCallbacks;
	/**
	 * Promise resolve function.
	 */
	resolve: (value: RecipeResponse) => void;
};

/**
 * Parses SSE events from a stream reader and processes them.
 *
 * @param options - Options for parsing the SSE stream.
 * @returns Promise that resolves when a terminal event is received or stream ends.
 */
export async function parseSseStream(options: ParseSseStreamOptions): Promise<void> {
	const { reader, decoder, buffer, callbacks, resolve } = options;
	const { done, value } = await reader.read();

	if (done) {
		resolve({
			success: false,
			error: "Stream ended unexpectedly",
		});
		return;
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

				const isTerminal = handleSseEvent(data, callbacks, resolve);
				if (isTerminal) {
					return;
				}
			} catch (error) {
				// Skip malformed SSE lines, but log for debugging in development
				if (process.env.NODE_ENV === "development") {
					console.warn("Failed to parse SSE event:", error, "Line:", line);
				}
			}
		}
	}

	return parseSseStream({
		reader,
		decoder,
		buffer: remainingBuffer,
		callbacks,
		resolve,
	});
}

/**
 * Handles a parsed SSE event and calls appropriate callbacks.
 *
 * @param data - The validated server progress event.
 * @param callbacks - Progress callbacks for UI updates.
 * @param resolve - Promise resolve function.
 * @returns True if the event was a terminal event (complete or error), false otherwise.
 */
export function handleSseEvent(
	data: ServerProgressEvent,
	callbacks: import("./types.js").ProgressCallbacks,
	resolve: (value: RecipeResponse) => void,
): boolean {
	if (data.type === ServerProgressEventType.Progress) {
		callbacks.onProgress(data.message);
		return false;
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
					healthiness: data.tags.healthiness,
					totalTimeMinutes: data.tags.totalTimeMinutes,
				},
			});
		}
		resolve({
			success: true,
			pageId: data.pageId,
			notionUrl: data.notionUrl,
		});
		return true;
	}

	if (data.type === ServerProgressEventType.Error) {
		callbacks.onError(data.error || "Unknown error", data.notionUrl);
		resolve({
			success: false,
			error: data.error || "Unknown error",
			notionUrl: data.notionUrl,
		});
		return true;
	}

	return false;
}
