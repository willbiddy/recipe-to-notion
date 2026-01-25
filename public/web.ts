/**
 * Web interface for Recipe to Notion.
 * Handles API key management, URL submission, and SSE progress updates.
 */

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
function saveRecipeWithProgress(url: string) {
	const serverUrl = getServerUrl();
	const apiUrl = `${serverUrl}/api/recipes`;

	return saveRecipe(url, apiUrl, storage, {
		onProgress: (message) => {
			showProgress(message);
			setLoading(true);
		},
		onComplete: (data) => {
			hideProgress();
			setLoading(false);
			displayRecipeInfo(data);
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
			// Recipe info is displayed in displayRecipeInfo callback
			// No need to show status here
		} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
			/**
			 * Handle duplicate errors specially.
			 */
			updateStatus(
				`This recipe already exists. <a href="${result.notionUrl}" target="_blank" class="underline font-semibold">Open in Notion</a>`,
				"info",
			);
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
	if (!settingsPanel || !settingsButton) {
		console.error("Settings panel or button not found", { settingsPanel, settingsButton });
		return;
	}

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
 * Displays recipe information after successful save, similar to CLI output.
 */
function displayRecipeInfo(data: {
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
}): void {
	const statusDiv = document.getElementById("status");
	if (!statusDiv) return;

	const infoLines: string[] = [];
	if (data.recipe.author) {
		infoLines.push(`<strong>Author:</strong> ${data.recipe.author}`);
	}
	infoLines.push(`<strong>Tags:</strong> ${data.tags.tags.join(", ")}`);
	infoLines.push(`<strong>Meal type:</strong> ${data.tags.mealType.join(", ")}`);
	infoLines.push(`<strong>Healthiness:</strong> ${data.tags.healthiness}/10`);
	infoLines.push(`<strong>Minutes:</strong> ${data.tags.totalTimeMinutes}`);
	infoLines.push(`<strong>Ingredients:</strong> ${data.recipe.ingredients.length} items`);
	infoLines.push(`<strong>Steps:</strong> ${data.recipe.instructions.length} steps`);

	const recipeTitle = data.recipe.name;
	const notionLink = `<a href="${data.notionUrl}" target="_blank" class="font-semibold underline hover:text-orange-900 transition-colors">${recipeTitle}</a>`;

	statusDiv.innerHTML = `
		<div class="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-5 space-y-3">
			<h3 class="text-lg font-bold text-orange-900 mb-3">${recipeTitle}</h3>
			<div class="space-y-2 text-sm text-orange-800">
				${infoLines.map((line) => `<div>${line}</div>`).join("")}
			</div>
			<div class="pt-3 border-t border-orange-200">
				<p class="text-sm text-orange-900">
					Recipe saved! Open in Notion: ${notionLink}
				</p>
			</div>
		</div>
	`;

	statusDiv.className =
		"py-4 px-5 rounded-xl text-sm leading-relaxed animate-[fadeIn_0.2s_ease-in] shadow-sm";
	statusDiv.classList.remove("hidden");
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
		// Validate that it's actually a URL, not a title or other text
		try {
			new URL(url);
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
		} catch {
			// Not a valid URL, ignore it
			console.warn("Invalid URL in query parameters:", url);
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
		settingsButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			toggleSettings();
		});
	} else {
		console.error("Settings button not found during init");
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
