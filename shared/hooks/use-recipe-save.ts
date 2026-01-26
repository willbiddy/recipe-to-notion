/**
 * Shared hook for recipe saving logic used by both ExtensionRecipeForm and WebRecipeForm.
 */

import { type Accessor, createSignal, type Setter } from "solid-js";
import type { RecipeResponse } from "../api/types.js";
import { StatusType } from "../components/status-message.js";
import { ErrorMessageKey, getErrorMessage } from "../constants.js";
import { isApiKeyError } from "../error-utils.js";
import type { StorageAdapter } from "../storage.js";
import { isValidHttpUrl } from "../url-utils.js";

/**
 * Options for API secret prompt handlers.
 */
export type ApiSecretHandlers = {
	setShowApiPrompt: Setter<boolean>;
	setPendingSave: Setter<(() => void) | null>;
	pendingSave: Accessor<(() => void) | null>;
	performSave: () => Promise<void>;
};

/**
 * Options for the useRecipeSave hook.
 */
export type UseRecipeSaveOptions = {
	storage: StorageAdapter;
	getApiUrl: () => string;
	getCurrentUrl: () => string | null;
	setStatus: Setter<{ message: string; type: StatusType } | null>;
	setLoading: Setter<boolean>;
	setProgress: Setter<string | null>;
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
			mealType: string[];
			healthiness: number;
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
 */
export type UseRecipeSaveResult = {
	saveRecipeWithProgress: (recipeUrl: string) => Promise<RecipeResponse>;
	performSave: () => Promise<void>;
	isInvalidApiKey: Accessor<boolean>;
	setIsInvalidApiKey: Setter<boolean>;
	handleApiSecretSaved: (handlers: ApiSecretHandlers) => void;
	handleUpdateApiKey: (handlers: ApiSecretHandlers) => void;
};

/**
 * Shared hook for recipe saving logic.
 *
 * Provides saveRecipeWithProgress and performSave functions that handle
 * progress streaming, error handling, and status updates.
 *
 * @param options - Configuration options for the hook.
 * @returns Object with save functions and state.
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
		const runSave = () => {
			void handlers.performSave();
		};
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
