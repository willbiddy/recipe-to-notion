/**
 * ExtensionRecipeForm component for the browser extension popup.
 * Handles recipe URL submission from current tab, progress updates, and settings management.
 */

import { createSignal, onMount, Show } from "solid-js";
import { type RecipeResponse, saveRecipe } from "../api.js";
import { createStorageAdapter } from "../storage.js";
import { ApiSecretPrompt } from "./ApiSecretPrompt.js";
import { ProgressIndicator } from "./ProgressIndicator.js";
import { StatusMessage, StatusType, TextSize } from "./StatusMessage.js";
import { UrlDisplay } from "./UrlDisplay.js";

export type ExtensionRecipeFormProps = {
	/** Function to get the server URL. */
	getServerUrl: () => string;
};

/**
 * Delay before opening Notion page (milliseconds).
 */
const NOTION_OPEN_DELAY_MS = 500;

/**
 * Extracts the website name from a URL (e.g., "bonappetit.com" -> "Bon Appétit").
 */
function getWebsiteName(url: string): string | null {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;

		// Remove www. prefix if present
		const cleanHostname = hostname.replace(/^www\./, "");

		// Extract the main domain name (e.g., "bonappetit.com" -> "bonappetit")
		const parts = cleanHostname.split(".");
		if (parts.length >= 2) {
			const domain = parts[parts.length - 2];
			if (domain) {
				// Convert to title case
				return domain.charAt(0).toUpperCase() + domain.slice(1).replace(/([A-Z])/g, " $1");
			}
		}

		return cleanHostname;
	} catch {
		return null;
	}
}

/**
 * Gets the current active tab URL, title, recipe title, and author if available.
 * Uses the content script to extract recipe data, which can import the actual parser code.
 */
async function getCurrentTab(): Promise<{
	url: string | null;
	title: string | null;
	recipeTitle: string | null;
	author: string | null;
	websiteName: string | null;
}> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	const url = tab?.url || null;
	const title = tab?.title || null;
	let recipeTitle: string | null = null;
	let author: string | null = null;
	let websiteName: string | null = null;

	// Extract website name from URL
	if (url) {
		websiteName = getWebsiteName(url);
	}

	// Try to extract recipe data from JSON-LD using the content script
	if (tab?.id && url && (url.startsWith("http://") || url.startsWith("https://"))) {
		try {
			// Send message to content script to extract recipe data
			const response = await chrome.tabs.sendMessage(tab.id, {
				type: "extract-recipe-data",
			});
			recipeTitle = response?.title || null;
			author = response?.author || null;
		} catch {
			// If messaging fails (e.g., content script not loaded, chrome:// pages), silently fail
		}
	}

	return {
		url,
		title,
		recipeTitle,
		author,
		websiteName,
	};
}

/**
 * ExtensionRecipeForm component.
 */
export function ExtensionRecipeForm(props: ExtensionRecipeFormProps) {
	const storage = createStorageAdapter();
	const [currentUrl, setCurrentUrl] = createSignal<string | null>(null);
	const [currentTitle, setCurrentTitle] = createSignal<string | null>(null);
	const [recipeTitle, setRecipeTitle] = createSignal<string | null>(null);
	const [recipeAuthor, setRecipeAuthor] = createSignal<string | null>(null);
	const [websiteName, setWebsiteName] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal<{ message: string; type: StatusType } | null>(null);
	const [progress, setProgress] = createSignal<string | null>(null);
	const [showApiPrompt, setShowApiPrompt] = createSignal(false);
	const [pendingSave, setPendingSave] = createSignal<(() => void) | null>(null);
	const [isInvalidApiKey, setIsInvalidApiKey] = createSignal(false);

	/**
	 * Saves a recipe with progress streaming.
	 */
	const saveRecipeWithProgress = (recipeUrl: string): Promise<RecipeResponse> => {
		const serverUrl = props.getServerUrl();
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
				onComplete: () => {
					setProgress(null);
					setLoading(false);
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
		const url = currentUrl();

		if (!url) {
			setStatus({
				message: "No URL found. Please navigate to a recipe page.",
				type: StatusType.Error,
			});
			return;
		}

		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			setStatus({ message: "Not a valid web page URL.", type: StatusType.Error });
			return;
		}

		setStatus(null);
		setLoading(true);
		setProgress("Starting...");

		try {
			const result = await saveRecipeWithProgress(url);

			if (result.success) {
				setStatus({ message: "Recipe saved successfully!", type: StatusType.Success });
				setTimeout(() => {
					setStatus({ message: "Opening...", type: StatusType.Info });
					setTimeout(() => {
						if (result.notionUrl) {
							chrome.tabs.create({ url: result.notionUrl });
						}
					}, NOTION_OPEN_DELAY_MS);
				}, NOTION_OPEN_DELAY_MS);
			} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
				setStatus({ message: "This recipe already exists. Opening...", type: StatusType.Info });
				setTimeout(() => {
					chrome.tabs.create({ url: result.notionUrl });
				}, NOTION_OPEN_DELAY_MS);
			} else {
				const errorMessage = result.error || "Failed to save recipe";
				// Check if error is related to invalid API key
				const isApiKeyError =
					errorMessage.toLowerCase().includes("invalid api key") ||
					errorMessage.toLowerCase().includes("missing authorization") ||
					errorMessage.toLowerCase().includes("invalid authorization");

				if (isApiKeyError) {
					setIsInvalidApiKey(true);
					setStatus({message: "Invalid API key. Please update your API secret.",
						type: StatusType.Error,
					});
				} else {
					setIsInvalidApiKey(false);
					setStatus({ message: errorMessage, type: StatusType.Error });
				}
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
	 * Handles when API secret is saved in the prompt.
	 */
	const handleApiSecretSaved = () => {
		setShowApiPrompt(false);
		setIsInvalidApiKey(false);
		// Execute the pending save if there was one
		const save = pendingSave();
		if (save) {
			setPendingSave(null);
			save();
		}
	};

	/**
	 * Handles updating the API key when it's invalid.
	 */
	const handleUpdateApiKey = () => {
		setPendingSave(() => performSave);
		setShowApiPrompt(true);
	};

	// Initialize on mount
	onMount(async () => {
		const { url, title, recipeTitle, author, websiteName } = await getCurrentTab();
		setCurrentUrl(url);
		setCurrentTitle(title);
		setRecipeTitle(recipeTitle);
		setRecipeAuthor(author);
		setWebsiteName(websiteName);
	});

	return (
		<div class="flex flex-col gap-3">
			{/* URL Display */}
			<UrlDisplay
				url={currentUrl()}
				title={recipeTitle() || currentTitle()}
				source={recipeAuthor() || websiteName()}
			/>

			{/* Save Button */}
			<button
				id="save-button"
				type="button"
				onClick={handleSave}
				disabled={loading() || isInvalidApiKey()}
				class="btn-primary group"
			>
				<Show
					when={loading()}
					fallback={
						<svg
							class="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200"
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
			<Show when={status()}>
				{(s) => (
					<div class="flex flex-col gap-2">
						<StatusMessage message={s().message} type={s().type} textSize={TextSize.Xs} />
						<Show when={isInvalidApiKey()}>
							<button
								type="button"
								onClick={handleUpdateApiKey}
								class="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors duration-200"
							>
								Update API Secret
							</button>
						</Show>
					</div>
				)}
			</Show>

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
