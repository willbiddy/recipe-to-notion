import { getServerUrl } from "./config.js";
import { saveRecipe } from "./shared/api.js";
import { createStorageAdapter } from "./shared/storage.js";
import {
	clearStatus,
	hideProgress,
	setLoading,
	setupApiKeyVisibilityToggle,
	showProgress,
	updateStatus,
} from "./shared/ui.js";

/**
 * Element IDs used in the popup.
 */
const POPUP_ELEMENT_IDS = {
	URL_DISPLAY: "url-display",
	SAVE_BUTTON: "save-button",
	SETTINGS_BUTTON: "settings-button",
	SETTINGS_PANEL: "settings-panel",
	API_KEY_INPUT: "api-key-input",
	SAVE_API_KEY_BUTTON: "save-api-key-button",
} as const;

/**
 * Delay before opening Notion page (milliseconds).
 */
const NOTION_OPEN_DELAY_MS = 500;

/**
 * Delay before clearing success status (milliseconds).
 */
const SUCCESS_STATUS_CLEAR_DELAY_MS = 2000;

/**
 * Gets the current active tab URL and title.
 *
 * @returns Object with the current tab's URL and title, or null values if unavailable.
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
 * Updates the UI to show the current page title or URL.
 *
 * Validates the URL and displays either the page title or a shortened URL.
 *
 * @param url - The current tab's URL.
 * @param title - The current tab's title.
 */
function updateUrlDisplay(url: string | null, title: string | null): void {
	const urlDisplay = document.getElementById("url-display");
	if (!urlDisplay) return;

	if (!url) {
		urlDisplay.textContent = "No URL found";
		urlDisplay.className =
			"text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center";
		return;
	}

	/**
	 * Validate it's an HTTP(S) URL.
	 */
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		urlDisplay.textContent = "Not a valid web page";
		urlDisplay.className =
			"text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center";
		return;
	}

	const trimmedTitle = title?.trim();
	if (trimmedTitle) {
		urlDisplay.textContent = trimmedTitle;
		urlDisplay.className =
			"text-sm text-gray-700 p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] flex items-center";
		urlDisplay.title = url;
	} else {
		try {
			const urlObj = new URL(url);
			const displayText = `${urlObj.hostname}${urlObj.pathname}`;
			urlDisplay.textContent = displayText;
			urlDisplay.className =
				"text-sm text-gray-700 p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] flex items-center";
			urlDisplay.title = url;
		} catch {
			urlDisplay.textContent = url;
			urlDisplay.className =
				"text-[14px] text-gray-700 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-accent-50 hover:border-primary-300 shadow-sm";
		}
	}
}

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 *
 * @param url - The recipe URL to save.
 * @returns Promise that resolves when the recipe is saved.
 */
function saveRecipeWithProgress(url: string) {
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
 * Handles the save button click event.
 *
 * Validates the URL and initiates recipe saving with progress updates.
 */
async function handleSave(): Promise<void> {
	const { url } = await getCurrentTab();
	if (!url) {
		updateStatus("No URL found. Please navigate to a recipe page.", "error", { textSize: "xs" });
		return;
	}

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
			setTimeout(() => {
				updateStatus("Opening...", "info", { textSize: "xs" });
				setTimeout(() => {
					if (result.notionUrl) {
						chrome.tabs.create({ url: result.notionUrl });
					}
				}, NOTION_OPEN_DELAY_MS);
			}, NOTION_OPEN_DELAY_MS);
		} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
			updateStatus("This recipe already exists. Opening...", "info", { textSize: "xs" });
			setTimeout(() => {
				chrome.tabs.create({ url: result.notionUrl });
			}, NOTION_OPEN_DELAY_MS);
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
 *
 * Shows or hides the settings accordion and updates the chevron icon rotation.
 */
/**
 * Chevron rotation values for settings button.
 */
const CHEVRON_ROTATION = {
	EXPANDED: "180deg",
	COLLAPSED: "0deg",
} as const;

function toggleSettings(): void {
	const settingsPanel = document.getElementById(POPUP_ELEMENT_IDS.SETTINGS_PANEL);
	const settingsButton = document.getElementById(POPUP_ELEMENT_IDS.SETTINGS_BUTTON);
	if (!settingsPanel || !settingsButton) {
		console.error("Settings panel or button not found");
		return;
	}

	const isHidden = settingsPanel.classList.contains("hidden");
	const chevron = settingsButton.querySelector(".settings-chevron") as HTMLElement | null;

	if (isHidden) {
		settingsPanel.classList.remove("hidden");
		settingsButton.setAttribute("aria-expanded", "true");
		if (chevron) {
			chevron.style.transform = `rotate(${CHEVRON_ROTATION.EXPANDED})`;
		}
		loadApiKeyIntoInput();
	} else {
		settingsPanel.classList.add("hidden");
		settingsButton.setAttribute("aria-expanded", "false");
		if (chevron) {
			chevron.style.transform = `rotate(${CHEVRON_ROTATION.COLLAPSED})`;
		}
	}
}

/**
 * Loads the API key from storage into the input field.
 *
 * Called when the settings panel is opened.
 */
async function loadApiKeyIntoInput(): Promise<void> {
	const input = document.getElementById(POPUP_ELEMENT_IDS.API_KEY_INPUT) as HTMLInputElement;
	if (!input) {
		return;
	}

	const apiKey = await storage.getApiKey();
	if (apiKey) {
		input.value = apiKey;
	} else {
		input.value = "";
	}
}

/**
 * Saves the API key to storage.
 *
 * Validates that the API key is not empty before saving.
 */
async function saveApiKey(): Promise<void> {
	const input = document.getElementById(POPUP_ELEMENT_IDS.API_KEY_INPUT) as HTMLInputElement;
	if (!input) {
		return;
	}

	const apiKey = input.value.trim();
	if (!apiKey) {
		updateStatus("API secret cannot be empty", "error", { textSize: "xs" });
		return;
	}

	try {
		await storage.saveApiKey(apiKey);
		updateStatus("API secret saved successfully", "success", { textSize: "xs" });
		setTimeout(() => {
			clearStatus();
		}, SUCCESS_STATUS_CLEAR_DELAY_MS);
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "Failed to save API secret", "error", {
			textSize: "xs",
		});
	}
}

/**
 * Initializes the popup UI.
 *
 * Sets up event listeners, displays current tab info, and checks API key configuration.
 */
async function init(): Promise<void> {
	const { url, title } = await getCurrentTab();
	updateUrlDisplay(url, title);

	const saveButton = document.getElementById(POPUP_ELEMENT_IDS.SAVE_BUTTON);
	if (saveButton) {
		saveButton.addEventListener("click", handleSave);
	}

	const settingsButton = document.getElementById(POPUP_ELEMENT_IDS.SETTINGS_BUTTON);
	if (settingsButton) {
		settingsButton.addEventListener("click", toggleSettings);
	}

	const saveApiKeyButton = document.getElementById(POPUP_ELEMENT_IDS.SAVE_API_KEY_BUTTON);
	if (saveApiKeyButton) {
		saveApiKeyButton.addEventListener("click", saveApiKey);
	}

	setupApiKeyVisibilityToggle();

	const apiKey = await storage.getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API secret not configured. Click the settings icon to set it up.", "error", {
			textSize: "xs",
		});
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
