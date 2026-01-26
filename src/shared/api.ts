/**
 * Shared API and SSE handling logic for both web and extension.
 */

import type { ProgressType } from "../index.js";
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
			notionUrl?: string;
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
			progressType: ProgressType;
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

										if (data.type === ServerProgressEventType.Progress) {
											callbacks.onProgress(data.message);
										} else if (data.type === ServerProgressEventType.Complete) {
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

/**
 * Validates that a parsed JSON object is a valid ServerProgressEvent.
 *
 * @param data - The parsed JSON data to validate.
 * @returns The validated ServerProgressEvent, or null if invalid.
 */
function validateServerProgressEvent(data: unknown): ServerProgressEvent | null {
	if (!data || typeof data !== "object" || data === null) {
		return null;
	}

	const obj = data as Record<string, unknown>;

	if (!("type" in obj) || typeof obj.type !== "string") {
		return null;
	}

	if (obj.type === ServerProgressEventType.Progress) {
		if (typeof obj.message === "string" && "progressType" in obj) {
			return {
				type: ServerProgressEventType.Progress,
				message: obj.message,
				progressType: obj.progressType as ProgressType,
			};
		}
		return null;
	}

	if (obj.type === ServerProgressEventType.Complete) {
		if (
			typeof obj.pageId === "string" &&
			typeof obj.notionUrl === "string" &&
			obj.recipe &&
			typeof obj.recipe === "object" &&
			obj.tags &&
			typeof obj.tags === "object" &&
			"name" in obj.recipe &&
			"ingredients" in obj.recipe &&
			"instructions" in obj.recipe &&
			"tags" in obj.tags &&
			"mealType" in obj.tags &&
			"healthiness" in obj.tags &&
			"totalTimeMinutes" in obj.tags
		) {
			return {
				type: ServerProgressEventType.Complete,
				success: true,
				pageId: obj.pageId,
				notionUrl: obj.notionUrl,
				recipe: {
					name: String(obj.recipe.name),
					author: "author" in obj.recipe && obj.recipe.author ? String(obj.recipe.author) : null,
					ingredients: Array.isArray(obj.recipe.ingredients)
						? obj.recipe.ingredients.map(String)
						: [],
					instructions: Array.isArray(obj.recipe.instructions)
						? obj.recipe.instructions.map(String)
						: [],
				},
				tags: {
					tags: Array.isArray(obj.tags.tags) ? obj.tags.tags.map(String) : [],
					mealType: Array.isArray(obj.tags.mealType) ? obj.tags.mealType.map(String) : [],
					healthiness: typeof obj.tags.healthiness === "number" ? obj.tags.healthiness : 0,
					totalTimeMinutes:
						typeof obj.tags.totalTimeMinutes === "number" ? obj.tags.totalTimeMinutes : 0,
				},
			};
		}
		return null;
	}

	if (obj.type === ServerProgressEventType.Error) {
		if (typeof obj.error === "string") {
			return {
				type: ServerProgressEventType.Error,
				success: false,
				error: obj.error,
				notionUrl: typeof obj.notionUrl === "string" ? obj.notionUrl : undefined,
			};
		}
		return null;
	}

	return null;
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
