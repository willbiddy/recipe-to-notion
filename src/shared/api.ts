/**
 * Shared API and SSE handling logic for both web and extension.
 */

import type { StorageAdapter } from "./storage.js";

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
 * Progress event from server.
 */
export type ServerProgressEvent =
	| {
			type: "progress";
			message: string;
	  }
	| {
			type: "complete";
			success: true;
			pageId: string;
			notionUrl: string;
	  }
	| {
			type: "error";
			success: false;
			error: string;
			notionUrl?: string;
	  };

/**
 * Callbacks for progress updates.
 */
export interface ProgressCallbacks {
	onProgress: (message: string) => void;
	onComplete: (data: { pageId: string; notionUrl: string }) => void;
	onError: (error: string, notionUrl?: string) => void;
}

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 */
export async function saveRecipe(
	url: string,
	apiUrl: string,
	storage: StorageAdapter,
	callbacks: ProgressCallbacks,
): Promise<RecipeResponse> {
	const apiKey = await storage.getApiKey();
	if (!apiKey) {
		return {
			success: false,
			error: "API secret not configured. Please set it in the settings.",
		};
	}

	return new Promise((resolve, reject) => {
		try {
			/**
			 * Use Server-Sent Events for progress updates.
			 */
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
						/**
						 * Try to parse as JSON for error details.
						 */
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
								// If JSON parsing fails, try to get text response
								const text = await response.text().catch(() => "");
								resolve({
									success: false,
									error: `Server error (${response.status}): ${response.statusText}${text ? ` - ${text}` : ""}`,
								});
							});
					}

					/**
					 * Read SSE stream.
					 */
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
								if (line.startsWith("data: ")) {
									try {
										const data = JSON.parse(line.slice(6)) as ServerProgressEvent;

										if (data.type === "progress") {
											callbacks.onProgress(data.message);
										} else if (data.type === "complete") {
											callbacks.onComplete({
												pageId: data.pageId,
												notionUrl: data.notionUrl,
											});
											resolve({
												success: true,
												pageId: data.pageId,
												notionUrl: data.notionUrl,
											});
											return;
										} else if (data.type === "error") {
											callbacks.onError(data.error || "Unknown error", data.notionUrl);
											resolve({
												success: false,
												error: data.error || "Unknown error",
												notionUrl: data.notionUrl,
											});
											return;
										}
									} catch (_e) {
										/**
										 * Ignore parse errors for malformed events.
										 */
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
					/**
					 * Network error - server might not be running.
					 */
					let errorMessage: string;
					if (error instanceof TypeError && error.message.includes("fetch")) {
						errorMessage = `Cannot connect to server.\n\nMake sure the server is running.`;
					} else if (error instanceof TypeError) {
						errorMessage = `Connection error: ${error.message}`;
					} else {
						errorMessage = error instanceof Error ? error.message : String(error);
					}

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
