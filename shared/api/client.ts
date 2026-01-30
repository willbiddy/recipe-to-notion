/**
 * API client for saving recipes with progress streaming.
 *
 * Provides the main `saveRecipe` function that:
 * 1. Validates API key
 * 2. Sends POST request to server with recipe URL
 * 3. Streams progress updates via Server-Sent Events (SSE)
 * 4. Handles errors with user-friendly messages
 *
 * The client supports both streaming (SSE) and non-streaming modes,
 * with automatic error recovery and detailed network error messages.
 */

import { parseSseStream } from "@shared/api/sse-utils";
import type { RecipeResponse, SaveRecipeOptions } from "@shared/api/types";

/**
 * Formats network errors into user-friendly messages.
 *
 * Converts technical fetch/network errors into messages users can understand
 * and act on (e.g., "Cannot connect to server" instead of "TypeError: Failed to fetch").
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
 * Handles error responses from the server.
 * Attempts to parse JSON error details, falls back to text if that fails.
 *
 * @param response - The HTTP response with error status
 * @returns RecipeResponse with error details
 */
async function handleErrorResponse(response: Response): Promise<RecipeResponse> {
	try {
		const errorData = await response.json();
		const errorMessage = errorData.error || errorData.message || "Unknown error";
		const errorResponse: RecipeResponse = {
			success: false,
			error: `Server error (${response.status}): ${errorMessage}`,
		};

		// Include notionUrl if present (for duplicate recipe errors)
		if (typeof errorData.notionUrl === "string") {
			errorResponse.notionUrl = errorData.notionUrl;
		}

		return errorResponse;
	} catch {
		// Failed to parse JSON - try to get text
		const text = await response.text().catch(() => "");
		return {
			success: false,
			error: `Server error (${response.status}): ${response.statusText}${text ? ` - ${text}` : ""}`,
		};
	}
}

/**
 * Sets up SSE stream reading and returns a promise that resolves with the final result.
 *
 * @param response - The HTTP response with SSE stream
 * @param callbacks - Callbacks for progress and error notifications
 * @returns Promise that resolves with the final RecipeResponse
 */
function handleSseStream(
	response: Response,
	callbacks: SaveRecipeOptions["callbacks"],
): Promise<RecipeResponse> {
	const reader = response.body?.getReader();

	if (!reader) {
		return Promise.resolve({
			success: false,
			error: "Failed to read response stream",
		});
	}

	const decoder = new TextDecoder();

	return parseSseStream({
		reader,
		decoder,
		buffer: "",
		callbacks,
	});
}

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 *
 * Makes a POST request to the API with the recipe URL, then opens an SSE stream
 * to receive real-time progress updates (scraping, AI tagging, Notion save).
 *
 * The function handles:
 * - API key validation (returns error if missing)
 * - Server errors (non-200 responses)
 * - Network errors (connection failures)
 * - SSE stream parsing and event handling
 * - Progress, complete, and error callbacks
 *
 * @param options - Options for saving the recipe.
 * @param options.url - The recipe URL to save.
 * @param options.apiUrl - The API endpoint URL (e.g., "http://localhost:3000/api/recipes").
 * @param options.storage - Storage adapter for retrieving API key.
 * @param options.callbacks - Progress callbacks (onProgress, onComplete, onError).
 * @returns Promise that resolves with the recipe response (success or error).
 *
 * @example
 * ```ts
 * const result = await saveRecipe({
 *   url: "https://example.com/recipe",
 *   apiUrl: "http://localhost:3000/api/recipes",
 *   storage: createStorageAdapter(),
 *   callbacks: {
 *     onProgress: (msg) => console.log(msg),
 *     onComplete: (data) => console.log("Saved:", data.notionUrl),
 *     onError: (err) => console.error(err)
 *   }
 * });
 *
 * if (result.success) {
 *   console.log("Recipe saved to:", result.notionUrl);
 * } else {
 *   console.error("Save failed:", result.error);
 * }
 * ```
 */
export async function saveRecipe({
	url,
	apiUrl,
	storage,
	callbacks,
}: SaveRecipeOptions): Promise<RecipeResponse> {
	// Step 1: Validate API key
	const apiKey = await storage.getApiKey();

	if (!apiKey) {
		return {
			success: false,
			error: "API secret not configured. Please set it in the settings.",
		};
	}

	try {
		// Step 2: Send POST request to server
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ url, stream: true }),
		});

		// Step 3: Handle error responses
		if (!response.ok) {
			return await handleErrorResponse(response);
		}

		// Step 4: Process SSE stream for progress updates
		return await handleSseStream(response, callbacks);
	} catch (error) {
		// Step 5: Handle network errors
		const errorMessage = formatNetworkError(error);
		callbacks.onError(errorMessage);
		return {
			success: false,
			error: errorMessage,
		};
	}
}
