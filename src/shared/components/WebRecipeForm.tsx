/**
 * WebRecipeForm component for the web interface.
 * Handles recipe URL submission, progress updates, and settings management.
 */

import { createSignal, onMount, Show } from "solid-js";
import { type RecipeResponse, saveRecipe } from "../api.js";
import { createStorageAdapter } from "../storage.js";
import { ProgressIndicator } from "./ProgressIndicator.js";
import { RecipeInfo, type RecipeInfoData } from "./RecipeInfo.js";
import { SettingsPanel } from "./SettingsPanel.js";
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
	const [settingsOpen, setSettingsOpen] = createSignal(false);

	// URL validation
	const urlValid = () => {
		const currentUrl = url();
		return currentUrl.trim() === "" ? null : validateUrl(currentUrl);
	};
	const showClearButton = () => url().trim().length > 0;

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
	 * Handles the save button click.
	 */
	const handleSave = async () => {
		const currentUrl = url().trim();

		if (!currentUrl) {
			setStatus({ message: "Please enter a recipe URL", type: StatusType.ERROR });
			return;
		}

		if (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://")) {
			setStatus({
				message: "Not a valid web page URL. Must start with http:// or https://",
				type: StatusType.ERROR,
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
					type: StatusType.INFO,
				});
			} else {
				setStatus({ message: result.error || "Failed to save recipe", type: StatusType.ERROR });
			}
		} catch (error) {
			setStatus({
				message: error instanceof Error ? error.message : "An unexpected error occurred",
				type: StatusType.ERROR,
			});
		} finally {
			setLoading(false);
			setProgress(null);
		}
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
	 * Toggles settings panel.
	 */
	const toggleSettings = () => {
		setSettingsOpen(!settingsOpen());
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
					}
				});
			} catch {
				console.warn("Invalid URL in query parameters:", urlParam);
			}
		}
	};

	// Initialize on mount
	onMount(async () => {
		handleQueryParameters();
		const key = await storage.getApiKey();
		if (!key) {
			setStatus({
				message: "⚠️ API secret not configured. Click Settings to set it up.",
				type: StatusType.ERROR,
			});
		}
	});

	return (
		<div class="flex flex-col gap-6">
			{/* URL Input */}
			<div class="flex flex-col gap-6">
				<label
					for="url-input"
					class="text-xl font-semibold text-primary-900 flex items-center gap-3"
				>
					<svg
						class="w-6 h-6 text-primary-700"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
						/>
					</svg>
					Recipe URL
				</label>
				<div class="relative">
					<input
						type="url"
						id="url-input"
						name="recipe-url"
						value={url()}
						onInput={handleUrlInput}
						onKeyDown={handleKeyDown}
						placeholder="https://cooking.nytimes.com/recipes/..."
						autocomplete="url"
						aria-label="Recipe URL"
						aria-invalid={urlValid() === false ? "true" : "false"}
						class="input-field"
					/>
					<svg
						class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-600 pointer-events-none"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
						/>
					</svg>
					<Show when={showClearButton()}>
						<button
							type="button"
							onClick={clearUrl}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600 hover:text-primary-800 p-1.5 rounded-lg hover:bg-primary-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
				<p class="text-base text-primary-900 flex items-start gap-2 leading-relaxed">
					<svg
						class="w-5 h-5 text-primary-700 mt-0.5 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					Paste a recipe URL from any website. The recipe will be scraped, analyzed, and saved to
					your Notion database.
				</p>
			</div>

			{/* Save Button */}
			<div class="mt-2">
				<button
					type="button"
					onClick={handleSave}
					disabled={loading()}
					aria-label="Save recipe to Notion"
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
			</div>

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

			{/* Settings Button */}
			<div class="flex items-center justify-start pt-6 mt-6 border-t-2 border-primary-200">
				<button
					type="button"
					onClick={toggleSettings}
					aria-label="Toggle settings panel"
					aria-expanded={settingsOpen()}
					aria-controls="settings-panel"
					class="btn-secondary"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="settings-icon"
						aria-hidden="true"
					>
						<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
					<span>Settings</span>
					<svg
						class={`w-4 h-4 transition-transform duration-200 settings-chevron ${settingsOpen() ? "rotate-180" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>
			</div>

			{/* Settings Panel */}
			<Show when={settingsOpen()}>
				<SettingsPanel panelClass="flex flex-col gap-6 pt-6 mt-6 border-t-2 border-primary-200 transition-all duration-300 ease-in-out overflow-hidden animate-slide-down" />
			</Show>
		</div>
	);
}
