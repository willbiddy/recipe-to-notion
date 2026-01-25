import { getServerUrl } from "./config.js";
import {
	clearStatus,
	hideProgress,
	setLoading,
	setupApiKeyVisibilityToggle,
	showProgress,
	updateStatus,
} from "./shared/ui.js";
import { saveRecipe } from "./shared/api.js";
import { createStorageAdapter } from "./shared/storage.js";

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
 * Storage adapter for this interface.
 */
const storage = createStorageAdapter();

/**
 * Updates the UI to show the current page title.
 */
function updateUrlDisplay(url: string | null, title: string | null): void {
	const urlDisplay = document.getElementById("url-display");
	if (!urlDisplay) return;

	if (!url) {
		urlDisplay.textContent = "No URL found";
		urlDisplay.className =
			"text-[14px] text-red-600 p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left shadow-sm";
		return;
	}

	/**
	 * Validate it's an HTTP(S) URL.
	 */
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		urlDisplay.textContent = "Not a valid web page";
		urlDisplay.className =
			"text-[14px] text-red-600 p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left shadow-sm";
		return;
	}

	/**
	 * Show the page title if available, otherwise fall back to shortened URL.
	 */
	const trimmedTitle = title?.trim();
	if (trimmedTitle) {
		urlDisplay.textContent = trimmedTitle;
		urlDisplay.className =
			"text-[14px] text-gray-700 p-3.5 bg-amber-50/60 border-2 border-orange-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-amber-50 hover:border-orange-300 shadow-sm";
		/**
		 * Show full URL in tooltip.
		 */
		urlDisplay.title = url;
	} else {
		/**
		 * Fallback to shortened URL if no title.
		 */
		try {
			const urlObj = new URL(url);
			const displayText = `${urlObj.hostname}${urlObj.pathname}`;
			urlDisplay.textContent = displayText;
			urlDisplay.className =
				"text-[14px] text-gray-700 p-3.5 bg-amber-50/60 border-2 border-orange-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-amber-50 hover:border-orange-300 shadow-sm";
			urlDisplay.title = url;
		} catch {
			urlDisplay.textContent = url;
			urlDisplay.className =
				"text-[14px] text-gray-700 p-3.5 bg-amber-50/60 border-2 border-orange-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-amber-50 hover:border-orange-300 shadow-sm";
		}
	}
}

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 */
async function saveRecipeWithProgress(url: string) {
	const serverUrl = getServerUrl();
	const apiUrl = `${serverUrl}/api/recipes`;

	return saveRecipe(url, apiUrl, storage, {
		onProgress: (message) => {
			showProgress(message);
			setLoading(true);
		},
		onComplete: () => {
			hideProgress();
			setLoading(false);
		},
		onError: () => {
			hideProgress();
			setLoading(false);
		},
	});
}

/**
 * Handles the save button click.
 */
async function handleSave(): Promise<void> {
	const { url } = await getCurrentTab();
	if (!url) {
		updateStatus("No URL found. Please navigate to a recipe page.", "error", { textSize: "xs" });
		return;
	}

	/**
	 * Validate URL.
	 */
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		updateStatus("Not a valid web page URL.", "error", { textSize: "xs" });
		return;
	}

	clearStatus();
	setLoading(true);
	showProgress("Starting...");

	try {
		const result = await saveRecipeWithProgress(url);

		if (result.success) {
			updateStatus("Recipe saved successfully!", "success", { textSize: "xs" });
			/**
			 * Show "Opening..." message, then open the Notion page.
			 */
			setTimeout(() => {
				updateStatus("Opening...", "info", { textSize: "xs" });
				setTimeout(() => {
					chrome.tabs.create({ url: result.notionUrl });
				}, 500);
			}, 500);
		} else if (result.error.includes("Duplicate recipe found") && result.notionUrl) {
			/**
			 * Handle duplicate errors specially.
			 */
			updateStatus(`This recipe already exists. Opening...`, "info", { textSize: "xs" });
			setTimeout(() => {
				chrome.tabs.create({ url: result.notionUrl });
			}, 500);
		} else {
			updateStatus(result.error || "Failed to save recipe", "error", { textSize: "xs" });
		}
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "An unexpected error occurred", "error", {
			textSize: "xs",
		});
	} finally {
		setLoading(false);
		hideProgress();
	}
}

/**
 * Toggles the settings panel visibility.
 */
function toggleSettings(): void {
	const settingsPanel = document.getElementById("settings-panel");
	if (!settingsPanel) return;

	const isHidden = settingsPanel.classList.contains("hidden");
	if (isHidden) {
		settingsPanel.classList.remove("hidden");
		loadApiKeyIntoInput();
	} else {
		settingsPanel.classList.add("hidden");
	}
}

/**
 * Loads the API key from storage into the input field.
 */
async function loadApiKeyIntoInput(): Promise<void> {
	const input = document.getElementById("api-key-input") as HTMLInputElement;
	if (!input) return;

	const apiKey = await storage.getApiKey();
	if (apiKey) {
		input.value = apiKey;
	} else {
		input.value = "";
	}
}

/**
 * Saves the API key to storage.
 */
async function saveApiKey(): Promise<void> {
	const input = document.getElementById("api-key-input") as HTMLInputElement;
	if (!input) return;

	const apiKey = input.value.trim();
	if (!apiKey) {
		updateStatus("API secret cannot be empty", "error", { textSize: "xs" });
		return;
	}

	try {
		// Use chrome.storage.local instead of sync to avoid syncing sensitive API secret to Google servers
		await storage.saveApiKey(apiKey);
		updateStatus("API secret saved successfully", "success", { textSize: "xs" });
		setTimeout(() => {
			clearStatus();
		}, 2000);
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "Failed to save API secret", "error", {
			textSize: "xs",
		});
	}
}

/**
 * Initializes the popup UI.
 */
async function init(): Promise<void> {
	/**
	 * Get and display current tab info.
	 */
	const { url, title } = await getCurrentTab();
	updateUrlDisplay(url, title);

	/**
	 * Set up event listeners.
	 */
	const saveButton = document.getElementById("save-button");
	if (saveButton) {
		saveButton.addEventListener("click", handleSave);
	}

	const settingsButton = document.getElementById("settings-button");
	if (settingsButton) {
		settingsButton.addEventListener("click", toggleSettings);
	}

	const saveApiKeyButton = document.getElementById("save-api-key-button");
	if (saveApiKeyButton) {
		saveApiKeyButton.addEventListener("click", saveApiKey);
	}

	/**
	 * Set up API key visibility toggle.
	 */
	setupApiKeyVisibilityToggle();

	/**
	 * Check if API key is configured and show warning if not.
	 */
	const apiKey = await storage.getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API secret not configured. Click the settings icon to set it up.", "error", {
			textSize: "xs",
		});
	}
}

/**
 * Initialize when DOM is ready.
 */
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
