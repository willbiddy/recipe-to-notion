/**
 * useRecipeSave - Shared hook for recipe saving logic and progress tracking.
 *
 * Provides a consistent recipe saving interface for both extension and web forms.
 * Handles progress streaming via Server-Sent Events (SSE), error handling,
 * duplicate detection, API key validation, and status updates.
 *
 * The hook orchestrates the complete save flow:
 * 1. URL validation
 * 2. API key check
 * 3. Recipe scraping (with progress updates)
 * 4. AI tagging (with progress updates)
 * 5. Notion page creation (with progress updates)
 * 6. Success/error/duplicate handling
 *
 * @example
 * ```tsx
 * const {
 *   performSave,
 *   isInvalidApiKey,
 *   handleApiSecretSaved,
 *   handleUpdateApiKey
 * } = useRecipeSave({
 *   storage,
 *   getApiUrl: () => "http://localhost:3000/api/recipes",
 *   getCurrentUrl: () => url(),
 *   setStatus,
 *   setLoading,
 *   setProgress,
 *   onSuccess: (result) => {
 *     console.log("Saved to:", result.notionUrl);
 *   }
 * });
 *
 * // Trigger save
 * await performSave();
 * ```
 */

import type { JSX } from "solid-js";
import { type Accessor, createSignal, type Setter } from "solid-js";
import type { RecipeResponse } from "../api/types.js";
import { StatusType } from "../components/status-message.js";
import { ErrorMessageKey, getErrorMessage } from "../constants.js";
import { isApiKeyError } from "../error-utils.js";
import type { StorageAdapter } from "../storage.js";
import { isValidHttpUrl } from "../url-utils.js";

/**
 * Options for API secret prompt handlers.
 * Used internally to coordinate API key prompt state and pending saves.
 */
export type ApiSecretHandlers = {
	setShowApiPrompt: Setter<boolean>;
	setPendingSave: Setter<(() => void) | null>;
	pendingSave: Accessor<(() => void) | null>;
	performSave: () => Promise<void>;
};

/**
 * Options for the useRecipeSave hook.
 *
 * Provides all dependencies and callbacks needed for recipe saving.
 */
export type UseRecipeSaveOptions = {
	/**
	 * Storage adapter for API key persistence.
	 */
	storage: StorageAdapter;
	/**
	 * Function returning the API endpoint URL (e.g., "http://localhost:3000/api/recipes").
	 */
	getApiUrl: () => string;
	/**
	 * Function returning the current recipe URL to save.
	 */
	getCurrentUrl: () => string | null;
	/**
	 * Setter for status message state (success, error, info).
	 */
	setStatus: Setter<{ message?: string; children?: JSX.Element; type: StatusType } | null>;
	/**
	 * Setter for loading state (true during save operation).
	 */
	setLoading: Setter<boolean>;
	/**
	 * Setter for progress message (e.g., "Scraping recipe...", "Saving to Notion...").
	 */
	setProgress: Setter<string | null>;
	/**
	 * Optional callback invoked when recipe is successfully saved.
	 * Receives the full recipe response including notionUrl.
	 */
	onSuccess?: (result: RecipeResponse) => void;
	onComplete?: (data: {
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
			mealType: string;
			healthScore: number;
			totalTimeMinutes: number;
		};
	}) => void;
	/**
	 * Callback for when a duplicate recipe is found.
	 * If it returns a string, that string will be used as the status message (can contain HTML).
	 * If it returns undefined, the callback is responsible for setting the status itself.
	 */
	onDuplicate?: (notionUrl: string) => string | undefined;
	noUrlErrorKey?: ErrorMessageKey;
};

/**
 * Result of the useRecipeSave hook.
 *
 * Provides save functions and API key state management.
 */
export type UseRecipeSaveResult = {
	/**
	 * Saves a recipe with progress streaming via SSE.
	 * Lower-level function used internally by performSave.
	 *
	 * @param recipeUrl - The recipe URL to save.
	 * @returns Promise resolving to RecipeResponse.
	 */
	saveRecipeWithProgress: (recipeUrl: string) => Promise<RecipeResponse>;
	/**
	 * Main save function that validates URL and triggers save flow.
	 * Call this function to initiate a recipe save.
	 *
	 * @returns Promise that resolves when save completes (success or error).
	 */
	performSave: () => Promise<void>;
	/**
	 * Reactive signal indicating if the current API key is invalid.
	 */
	isInvalidApiKey: Accessor<boolean>;
	/**
	 * Setter for isInvalidApiKey signal.
	 */
	setIsInvalidApiKey: Setter<boolean>;
	/**
	 * Handler for when API secret is saved via prompt.
	 * Resumes pending save operation if one exists.
	 *
	 * @param handlers - API secret prompt handlers.
	 */
	handleApiSecretSaved: (handlers: ApiSecretHandlers) => void;
	/**
	 * Handler for initiating API key update flow.
	 * Shows API prompt and queues save operation.
	 *
	 * @param handlers - API secret prompt handlers.
	 */
	handleUpdateApiKey: (handlers: ApiSecretHandlers) => void;
};

/**
 * Shared hook for recipe saving logic.
 *
 * Provides saveRecipeWithProgress and performSave functions that handle
 * progress streaming, error handling, and status updates. Implements the
 * complete recipe save flow with validation, duplicate detection, and
 * comprehensive error handling.
 *
 * @param options - Configuration options for the hook.
 * @returns Object with save functions, API key state, and event handlers.
 *
 * @example
 * ```tsx
 * const save = useRecipeSave({
 *   storage: createStorageAdapter(),
 *   getApiUrl: () => "http://localhost:3000/api/recipes",
 *   getCurrentUrl: () => "https://example.com/recipe",
 *   setStatus: setStatus,
 *   setLoading: setLoading,
 *   setProgress: setProgress,
 *   onSuccess: (result) => alert(`Saved: ${result.notionUrl}`),
 *   onDuplicate: (url) => `Recipe exists at ${url}`
 * });
 *
 * // Use performSave to trigger save
 * await save.performSave();
 * ```
 */
export function useRecipeSave(options: UseRecipeSaveOptions): UseRecipeSaveResult {
	const [isInvalidApiKey, setIsInvalidApiKey] = createSignal(false);

	async function saveRecipeWithProgress(recipeUrl: string): Promise<RecipeResponse> {
		const { saveRecipe } = await import("../api/client.js");
		const apiUrl = options.getApiUrl();

		return saveRecipe({
			url: recipeUrl,
			apiUrl,
			storage: options.storage,
			callbacks: {
				onProgress: (message) => {
					options.setProgress(message);
					options.setLoading(true);
				},
				onComplete: (data) => {
					options.setProgress(null);
					options.setLoading(false);
					options.onComplete?.(data);
				},
				onError: () => {
					options.setProgress(null);
					options.setLoading(false);
				},
			},
		});
	}

	async function performSave() {
		const url = options.getCurrentUrl();

		if (!url) {
			options.setStatus({
				message: getErrorMessage(options.noUrlErrorKey ?? ErrorMessageKey.NoUrlFound),
				type: StatusType.Error,
			});
			return;
		}

		if (!isValidHttpUrl(url)) {
			options.setStatus({
				message: getErrorMessage(ErrorMessageKey.NotValidWebPageUrl),
				type: StatusType.Error,
			});
			return;
		}

		options.setStatus(null);
		options.setLoading(true);
		options.setProgress("Starting...");

		try {
			const result = await saveRecipeWithProgress(url);

			if (result.success) {
				options.onSuccess?.(result);
			} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
				if (options.onDuplicate) {
					const message = options.onDuplicate(result.notionUrl);
					if (typeof message === "string") {
						options.setStatus({
							message,
							type: StatusType.Info,
						});
					}
				} else {
					options.setStatus({
						message: `This recipe already exists. <a href="${result.notionUrl}" target="_blank" class="underline font-semibold">Open in Notion</a>`,
						type: StatusType.Info,
					});
				}
			} else {
				const errorMessage = result.error || getErrorMessage(ErrorMessageKey.FailedToSaveRecipe);

				if (isApiKeyError(errorMessage)) {
					setIsInvalidApiKey(true);
					options.setStatus({
						message: getErrorMessage(ErrorMessageKey.InvalidApiKey),
						type: StatusType.Error,
					});
				} else {
					setIsInvalidApiKey(false);
					options.setStatus({
						message: errorMessage,
						type: StatusType.Error,
					});
				}
			}
		} catch (error) {
			options.setStatus({
				message:
					error instanceof Error ? error.message : getErrorMessage(ErrorMessageKey.UnexpectedError),
				type: StatusType.Error,
			});
		} finally {
			options.setLoading(false);
			options.setProgress(null);
		}
	}

	function handleApiSecretSaved(handlers: ApiSecretHandlers) {
		handlers.setShowApiPrompt(false);
		setIsInvalidApiKey(false);
		const save = handlers.pendingSave();
		if (save) {
			handlers.setPendingSave(null);
			save();
		}
	}

	function handleUpdateApiKey(handlers: ApiSecretHandlers) {
		function runSave() {
			handlers.performSave().catch((error) => {
				console.error("Failed to perform save:", error);
				// Error will be handled by the performSave function's internal error handling
			});
		}
		handlers.setPendingSave(() => runSave);
		handlers.setShowApiPrompt(true);
	}

	return {
		saveRecipeWithProgress,
		performSave,
		isInvalidApiKey,
		setIsInvalidApiKey,
		handleApiSecretSaved: (handlers: ApiSecretHandlers) => handleApiSecretSaved(handlers),
		handleUpdateApiKey: (handlers: ApiSecretHandlers) => handleUpdateApiKey(handlers),
	};
}
