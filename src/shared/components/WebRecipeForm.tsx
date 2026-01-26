/**
 * WebRecipeForm component for the web interface.
 * Handles recipe URL submission, progress updates, and settings management.
 */

import { createSignal, onMount, Show } from "solid-js";
import { type RecipeResponse, saveRecipe } from "../api.js";
import { createStorageAdapter } from "../storage.js";
import { ApiSecretPrompt } from "./ApiSecretPrompt.js";
import { ProgressIndicator } from "./ProgressIndicator.js";
import { RecipeInfo, type RecipeInfoData } from "./RecipeInfo.js";
import { StatusMessage, StatusType } from "./StatusMessage.js";

/**
 * Delay before auto-submitting URL from query parameters (milliseconds).
 */
const AUTO_SUBMIT_DELAY_MS = 300;

/**
 * Delay before clearing URL input after successful save (milliseconds).
 */
const CLEAR_URL_INPUT_DELAY_MS = 500;

/**
 * Gets the server URL from the current origin.
 */
function getServerUrl(): string {
	return window.location.origin;
}

/**
 * Validates a URL.
 */
function validateUrl(url: string): boolean {
	if (!url.trim()) {
		return false;
	}
	try {
		const urlObj = new URL(url);
		return urlObj.protocol === "http:" || urlObj.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * WebRecipeForm component.
 */
export function WebRecipeForm() {
	const storage = createStorageAdapter();
	const [url, setUrl] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal<{ message: string; type: StatusType } | null>(null);
	const [progress, setProgress] = createSignal<string | null>(null);
	const [recipeInfo, setRecipeInfo] = createSignal<RecipeInfoData | null>(null);
	const [showApiPrompt, setShowApiPrompt] = createSignal(false);
	const [pendingSave, setPendingSave] = createSignal<(() => void) | null>(null);

	function urlValid() {
		const currentUrl = url();
		return currentUrl.trim() === "" ? null : validateUrl(currentUrl);
	}

	function showClearButton() {
		url().trim().length > 0;
	}

	/**
	 * Saves a recipe with progress streaming.
	 */
	const saveRecipeWithProgress = (recipeUrl: string): Promise<RecipeResponse> => {
		const serverUrl = getServerUrl();
		const apiUrl = `${serverUrl}/api/recipes`;

		return saveRecipe({
			url: recipeUrl,
			apiUrl,
			storage,
			callbacks: {
				onProgress: (message) => {
					setProgress(message);
					setLoading(true);
				},
				onComplete: (data) => {
					setProgress(null);
					setLoading(false);
					setRecipeInfo(data);
					setStatus(null);
				},
				onError: () => {
					setProgress(null);
					setLoading(false);
				},
			},
		});
	};

	/**
	 * Actually saves the recipe (called after API secret is confirmed).
	 */
	const performSave = async () => {
		const currentUrl = url().trim();

		if (!currentUrl) {
			setStatus({ message: "Please enter a recipe URL", type: StatusType.Error });
			return;
		}

		if (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://")) {
			setStatus({
				message: "Not a valid web page URL. Must start with http:// or https://",
				type: StatusType.Error,
			});
			return;
		}

		setStatus(null);
		setRecipeInfo(null);
		setLoading(true);
		setProgress("Starting...");

		try {
			const result = await saveRecipeWithProgress(currentUrl);

			if (result.success) {
				// Recipe info is displayed via recipeInfo signal
				setTimeout(() => {
					setUrl("");
				}, CLEAR_URL_INPUT_DELAY_MS);
			} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
				setStatus({
					message: `This recipe already exists. <a href="${result.notionUrl}" target="_blank" class="underline font-semibold">Open in Notion</a>`,
					type: StatusType.Info,
				});
			} else {
				setStatus({ message: result.error || "Failed to save recipe", type: StatusType.Error });
			}
		} catch (error) {
			setStatus({
				message: error instanceof Error ? error.message : "An unexpected error occurred",
				type: StatusType.Error,
			});
		} finally {
			setLoading(false);
			setProgress(null);
		}
	};

	/**
	 * Handles the save button click.
	 */
	const handleSave = async () => {
		// Check if API secret is configured
		const apiKey = await storage.getApiKey();
		if (!apiKey) {
			// Show prompt and save the save action for later
			setPendingSave(() => performSave);
			setShowApiPrompt(true);
			return;
		}

		// API secret exists, proceed with save
		await performSave();
	};

	/**
	 * Clears the URL input.
	 */
	const clearUrl = () => {
		setUrl("");
		setStatus(null);
		setRecipeInfo(null);
	};

	/**
	 * Handles URL input changes.
	 */
	const handleUrlInput = (e: Event) => {
		const value = (e.target as HTMLInputElement).value;
		setUrl(value);
	};

	/**
	 * Handles keyboard shortcuts.
	 */
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
	};

	/**
	 * Handles when API secret is saved in the prompt.
	 */
	const handleApiSecretSaved = () => {
		setShowApiPrompt(false);
		// Execute the pending save if there was one
		const save = pendingSave();
		if (save) {
			setPendingSave(null);
			save();
		}
	};

	/**
	 * Handles query parameters for auto-submit.
	 */
	const handleQueryParameters = () => {
		const urlParams = new URLSearchParams(window.location.search);
		const urlParam = urlParams.get("url");

		if (urlParam) {
			try {
				new URL(urlParam);
				setUrl(urlParam);
				storage.getApiKey().then((key) => {
					if (key) {
						setTimeout(() => {
							handleSave();
						}, AUTO_SUBMIT_DELAY_MS);
					} else {
						// Show prompt if no API key
						setPendingSave(() => performSave);
						setShowApiPrompt(true);
					}
				});
			} catch {
				console.warn("Invalid URL in query parameters:", urlParam);
			}
		}
	};

	// Initialize on mount
	onMount(() => {
		handleQueryParameters();
	});

	return (
		<div class="flex flex-col gap-4">
			{/* URL Input */}
			<div class="flex flex-col gap-3">
				<div class="relative">
					<input
						type="url"
						id="url-input"
						name="recipe-url"
						value={url()}
						onInput={handleUrlInput}
						onKeyDown={handleKeyDown}
						placeholder="Paste recipe URL..."
						autocomplete="url"
						aria-label="Recipe URL"
						aria-invalid={urlValid() === false ? "true" : "false"}
						class="input-field"
					/>
					<Show when={showClearButton()}>
						<button
							type="button"
							onClick={clearUrl}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
							aria-label="Clear URL"
							title="Clear URL"
						>
							<svg
								class="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</Show>
					<div class="sr-only" aria-live="polite" aria-atomic="true">
						<Show when={urlValid() !== null}>
							{urlValid() ? "Valid URL" : "Invalid URL format"}
						</Show>
					</div>
				</div>
			</div>

			{/* Save Button */}
			<button
				type="button"
				onClick={handleSave}
				disabled={loading()}
				aria-label="Save recipe with Recipe Clipper for Notion"
				class="btn-primary group"
			>
				<Show
					when={loading()}
					fallback={
						<svg
							class="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					}
				>
					<div
						class="button-spinner w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"
						aria-hidden="true"
					/>
				</Show>
				<span class="button-text">{loading() ? "Processing..." : "Save Recipe"}</span>
			</button>

			{/* Progress Indicator */}
			<Show when={progress()}>{(msg) => <ProgressIndicator message={msg()} />}</Show>

			{/* Status Message */}
			<Show when={status()}>{(s) => <StatusMessage message={s().message} type={s().type} />}</Show>

			{/* Recipe Info */}
			<Show when={recipeInfo()}>
				{(info) => (
					<div class="py-4 px-5 rounded-2xl text-sm leading-relaxed animate-[fadeIn_0.2s_ease-in] shadow-sm">
						<RecipeInfo data={info()} />
					</div>
				)}
			</Show>

			<div class="flex-grow" />

			{/* API Secret Prompt */}
			<Show when={showApiPrompt()}>
				<ApiSecretPrompt
					onSecretSaved={handleApiSecretSaved}
					onCancel={() => {
						setShowApiPrompt(false);
						setPendingSave(null);
					}}
				/>
			</Show>
		</div>
	);
}
