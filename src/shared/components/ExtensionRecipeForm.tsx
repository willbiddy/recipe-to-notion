/**
 * ExtensionRecipeForm component for the browser extension popup.
 * Handles recipe URL submission from current tab, progress updates, and settings management.
 */

import { createSignal, onMount, Show } from "solid-js";
import { type RecipeResponse, saveRecipe } from "../api.js";
import { createStorageAdapter } from "../storage.js";
import { ProgressIndicator } from "./ProgressIndicator.js";
import { SettingsPanel } from "./SettingsPanel.js";
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
 * Gets the current active tab URL and title.
 */
async function getCurrentTab(): Promise<{ url: string | null; title: string | null }> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return {
		url: tab?.url || null,
		title: tab?.title || null,
	};
}

/**
 * ExtensionRecipeForm component.
 */
export function ExtensionRecipeForm(props: ExtensionRecipeFormProps) {
	const storage = createStorageAdapter();
	const [currentUrl, setCurrentUrl] = createSignal<string | null>(null);
	const [currentTitle, setCurrentTitle] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal<{ message: string; type: StatusType } | null>(null);
	const [progress, setProgress] = createSignal<string | null>(null);
	const [settingsOpen, setSettingsOpen] = createSignal(false);

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
	 * Handles the save button click.
	 */
	const handleSave = async () => {
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
	 * Toggles settings panel.
	 */
	const toggleSettings = () => {
		setSettingsOpen(!settingsOpen());
	};

	/**
	 * Checks if API key is configured and updates status accordingly.
	 */
	const checkApiKey = async () => {
		const apiKey = await storage.getApiKey();
		if (apiKey) {
			// Clear the error status if API key exists
			const currentStatus = status();
			if (currentStatus?.message.includes("API secret not configured")) {
				setStatus(null);
			}
		} else {
			setStatus({
				message: "⚠️ API secret not configured. Click the settings icon to set it up.",
				type: StatusType.Error,
			});
		}
	};

	/**
	 * Handles when API key is saved in settings.
	 */
	const handleApiKeySaved = () => {
		checkApiKey();
	};

	// Initialize on mount
	onMount(async () => {
		const { url, title } = await getCurrentTab();
		setCurrentUrl(url);
		setCurrentTitle(title);

		const apiKey = await storage.getApiKey();
		if (!apiKey) {
			setStatus({
				message: "⚠️ API secret not configured. Click the settings icon to set it up.",
				type: StatusType.Error,
			});
		}
	});

	return (
		<div class="flex flex-col gap-3">
			{/* URL Display */}
			<UrlDisplay url={currentUrl()} title={currentTitle()} />

			{/* Save Button */}
			<button
				id="save-button"
				type="button"
				onClick={handleSave}
				disabled={loading()}
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
				{(s) => <StatusMessage message={s().message} type={s().type} textSize={TextSize.Xs} />}
			</Show>

			{/* Settings Button */}
			<div class="flex items-center justify-start pt-2 border-t border-gray-200">
				<button
					id="settings-button"
					type="button"
					onClick={toggleSettings}
					aria-label="Toggle settings panel"
					aria-expanded={settingsOpen()}
					aria-controls="settings-panel"
					class="text-xs text-gray-600 hover:text-gray-900 transition-colors duration-200 flex items-center gap-2"
					title="Settings"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
					<span>Settings</span>
					<svg
						class={`w-3 h-3 transition-transform duration-200 ${settingsOpen() ? "rotate-180" : ""}`}
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
				<SettingsPanel
					textSize={TextSize.Xs}
					panelClass="flex flex-col gap-3 pt-3 border-t border-gray-200"
					helpTextClass="text-xs text-gray-600"
					onClose={toggleSettings}
					onApiKeySaved={handleApiKeySaved}
				/>
			</Show>
		</div>
	);
}
