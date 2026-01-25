/**
 * Shared API and SSE handling logic for both web and extension.
 */

import type { StorageAdapter } from "./storage.js";

/**
 * SSE event data prefix pattern.
 */
const SSE_DATA_PREFIX = "data: ";

/**
 * Length of SSE data prefix (for slicing JSON data from event line).
 */
const SSE_DATA_PREFIX_LENGTH = 6;

/**
 * Response format from the server API.
 */
export type RecipeResponse =
	| {
			success: true;
			pageId: string;
			notionUrl: string;
	  }
	| {
			success: false;
			error: string;
			notionUrl?: string; // May be present for duplicate errors
	  };

/**
 * Server-Sent Event types for recipe processing progress.
 */
export enum ServerProgressEventType {
	Progress = "progress",
	Complete = "complete",
	Error = "error",
}

/**
 * Progress event from server.
 */
export type ServerProgressEvent =
	| {
			type: ServerProgressEventType.Progress;
			message: string;
	  }
	| {
			type: ServerProgressEventType.Complete;
			success: true;
			pageId: string;
			notionUrl: string;
			recipe: {
				name: string;
				author: string | null;
				ingredients: string[];
				instructions: string[];
			};
			tags: {
				tags: string[];
				mealType: string[];
				healthiness: number;
				totalTimeMinutes: number;
			};
	  }
	| {
			type: ServerProgressEventType.Error;
			success: false;
			error: string;
			notionUrl?: string;
	  };

/**
 * Callbacks for progress updates.
 */
export type ProgressCallbacks = {
	onProgress: (message: string) => void;
	onComplete: (data: {
		pageId: string;
		notionUrl: string;
		recipe: {
			name: string;
			author: string | null;
			ingredients: string[];
			instructions: string[];
		};
		tags: {
			tags: string[];
			mealType: string[];
			healthiness: number;
			totalTimeMinutes: number;
		};
	}) => void;
	onError: (error: string, notionUrl?: string) => void;
};

/**
 * Options for saving a recipe.
 */
export type SaveRecipeOptions = {
	url: string;
	apiUrl: string;
	storage: StorageAdapter;
	callbacks: ProgressCallbacks;
};

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

					const readChunk = (): Promise<void> => {
						// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE parsing logic is inherently complex
						return reader.read().then(({ done, value }) => {
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
										const data = JSON.parse(
											line.slice(SSE_DATA_PREFIX_LENGTH),
										) as ServerProgressEvent;

										if (data.type === ServerProgressEventType.Progress) {
											callbacks.onProgress(data.message);
										} else if (data.type === ServerProgressEventType.Complete) {
											callbacks.onComplete({
												pageId: data.pageId,
												notionUrl: data.notionUrl,
												recipe: data.recipe,
												tags: data.tags,
											});
											resolve({
												success: true,
												pageId: data.pageId,
												notionUrl: data.notionUrl,
											});
											return;
										} else if (data.type === ServerProgressEventType.Error) {
											callbacks.onError(data.error || "Unknown error", data.notionUrl);
											resolve({
												success: false,
												error: data.error || "Unknown error",
												notionUrl: data.notionUrl,
											});
											return;
										}
									} catch {
										// Ignore parse errors for malformed SSE events
									}
								}
							}

							return readChunk();
						});
					};

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
