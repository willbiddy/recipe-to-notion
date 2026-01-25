/**
 * Web interface for Recipe to Notion.
 * Handles API key management, URL submission, and SSE progress updates.
 */

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
 * Gets the server URL from the current origin.
 */
function getServerUrl(): string {
	// Use the current origin (works for both localhost and production)
	return window.location.origin;
}

/**
 * Storage adapter for this interface.
 */
const storage = createStorageAdapter();

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
	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	const url = urlInput?.value.trim();

	if (!url) {
		updateStatus("Please enter a recipe URL", "error");
		return;
	}

	/**
	 * Validate URL.
	 */
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		updateStatus("Not a valid web page URL. Must start with http:// or https://", "error");
		return;
	}

	clearStatus();
	setLoading(true);
	showProgress("Starting...");

	try {
		const result = await saveRecipeWithProgress(url);

		if (result.success) {
			updateStatus("Recipe saved successfully!", "success");
			/**
			 * Show "Opening..." message, then open the Notion page.
			 */
			setTimeout(() => {
				updateStatus("Opening Notion page...", "info");
				setTimeout(() => {
					window.open(result.notionUrl, "_blank");
				}, 500);
			}, 500);
		} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
			/**
			 * Handle duplicate errors specially.
			 */
			updateStatus(`This recipe already exists. Opening...`, "info");
			setTimeout(() => {
				window.open(result.notionUrl, "_blank");
			}, 500);
		} else {
			updateStatus(result.error || "Failed to save recipe", "error");
		}
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "An unexpected error occurred", "error");
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
	const settingsButton = document.getElementById("settings-button");
	if (!settingsPanel || !settingsButton) return;

	const isHidden = settingsPanel.classList.contains("hidden");
	const chevron = settingsButton.querySelector(".settings-chevron") as HTMLElement | null;

	if (isHidden) {
		settingsPanel.classList.remove("hidden");
		settingsButton.setAttribute("aria-expanded", "true");
		if (chevron) {
			chevron.style.transform = "rotate(180deg)";
		}
		loadApiKeyIntoInput();
	} else {
		settingsPanel.classList.add("hidden");
		settingsButton.setAttribute("aria-expanded", "false");
		if (chevron) {
			chevron.style.transform = "rotate(0deg)";
		}
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
async function saveApiKeyToStorage(): Promise<void> {
	const input = document.getElementById("api-key-input") as HTMLInputElement;
	if (!input) return;

	const apiKey = input.value.trim();
	if (!apiKey) {
		updateStatus("API secret cannot be empty", "error");
		return;
	}

	try {
		await storage.saveApiKey(apiKey);
		updateStatus("API secret saved successfully", "success");
		setTimeout(() => {
			clearStatus();
		}, 2000);
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "Failed to save API secret", "error");
	}
}

/**
 * Parses URL from query parameters and auto-fills the input.
 */
function handleQueryParameters(): void {
	const urlParams = new URLSearchParams(window.location.search);
	const url = urlParams.get("url");

	if (url) {
		const urlInput = document.getElementById("url-input") as HTMLInputElement;
		if (urlInput) {
			urlInput.value = url;
			// Auto-submit if API key exists
			storage.getApiKey().then((apiKey) => {
				if (apiKey) {
					// Small delay to ensure UI is ready
					setTimeout(() => {
						handleSave();
					}, 300);
				}
			});
		}
	}
}

/**
 * Handles Web Share Target API (for Android Chrome).
 */
function handleWebShareTarget(): void {
	// Check if this page was opened via Web Share Target API
	if ("serviceWorker" in navigator) {
		// The share data is passed via URL parameters when using Web Share Target
		// We already handle this in handleQueryParameters()
	}
}

/**
 * Initializes the web interface.
 */
async function init(): Promise<void> {
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
		saveApiKeyButton.addEventListener("click", saveApiKeyToStorage);
	}

	/**
	 * Set up API key visibility toggle.
	 */
	setupApiKeyVisibilityToggle();

	/**
	 * Allow Enter key to submit URL.
	 */
	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	if (urlInput) {
		urlInput.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				handleSave();
			}
		});
		// Auto-focus on URL input
		urlInput.focus();
	}

	/**
	 * Handle query parameters (for iOS Shortcuts, sharing, etc.).
	 */
	handleQueryParameters();

	/**
	 * Handle Web Share Target API (Android).
	 */
	handleWebShareTarget();

	/**
	 * Check if API key is configured and show warning if not.
	 */
	const apiKey = await storage.getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API secret not configured. Click Settings to set it up.", "error");
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
