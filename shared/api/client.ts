import type { RecipeResponse, SaveRecipeOptions } from "./types.js";
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
 * Formats network errors into user-friendly messages.
 *
 * @param error - The error that occurred.
 * @returns Formatted error message string.
 */
function formatNetworkError(error: unknown): string {
	if (error instanceof TypeError && error.message.includes("fetch")) {
		return "Cannot connect to server.\n\nMake sure the server is running.";
	}

	if (error instanceof TypeError) {
		return `Connection error: ${error.message}`;
	}

	return error instanceof Error ? error.message : String(error);
}

/**
 * Handles a parsed SSE event and calls appropriate callbacks.
 *
 * @param data - The validated server progress event.
 * @param callbacks - Progress callbacks for UI updates.
 * @param resolve - Promise resolve function.
 * @returns True if the event was a terminal event (complete or error), false otherwise.
 */
function handleSseEvent(
	data: import("./types.js").ServerProgressEvent,
	callbacks: import("./types.js").ProgressCallbacks,
	resolve: (value: RecipeResponse) => void,
): boolean {
	if (data.type === ServerProgressEventType.Progress) {
		callbacks.onProgress(data.message);
		return false;
	}

	if (data.type === ServerProgressEventType.Complete) {
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

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 *
 * Uses Server-Sent Events (SSE) to stream progress updates to the client.
 *
 * @param options - Options for saving the recipe.
 * @returns Promise that resolves with the recipe response.
 */
export async function saveRecipe({
	url,
	apiUrl,
	storage,
	callbacks,
}: SaveRecipeOptions): Promise<RecipeResponse> {
	const apiKey = await storage.getApiKey();

	if (!apiKey) {
		return {
			success: false,
			error: "API secret not configured. Please set it in the settings.",
		};
	}

	return new Promise((resolve, reject) => {
		try {
			fetch(apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({ url, stream: true }),
			})
				.then((response) => {
					if (!response.ok) {
						return response
							.json()
							.then((errorData) => {
								const errorMessage = errorData.error || errorData.message || "Unknown error";
								resolve({
									success: false,
									error: `Server error (${response.status}): ${errorMessage}`,
									...errorData,
								} as RecipeResponse);
							})
							.catch(async () => {
								const text = await response.text().catch(() => "");
								resolve({
									success: false,
									error: `Server error (${response.status}): ${response.statusText}${text ? ` - ${text}` : ""}`,
								});
							});
					}

					const reader = response.body?.getReader();
					const decoder = new TextDecoder();

					if (!reader) {
						resolve({
							success: false,
							error: "Failed to read response stream",
						});
						return;
					}

					let buffer = "";
					const streamReader = reader;

					function readChunk(): Promise<void> {
						return streamReader.read().then(({ done, value }) => {
							if (done) {
								resolve({
									success: false,
									error: "Stream ended unexpectedly",
								});
								return;
							}

							buffer += decoder.decode(value, { stream: true });
							const lines = buffer.split("\n");
							buffer = lines.pop() || "";

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
									} catch {
										// Ignore malformed SSE events
									}
								}
							}

							return readChunk();
						});
					}

					readChunk().catch((error) => {
						callbacks.onError(error instanceof Error ? error.message : String(error));
						reject(error);
					});
				})
				.catch((error) => {
					const errorMessage = formatNetworkError(error);
					callbacks.onError(errorMessage);
					resolve({
						success: false,
						error: errorMessage,
					});
				});
		} catch (error) {
			callbacks.onError(error instanceof Error ? error.message : String(error));
			reject(error);
		}
	});
}
