/**
 * Web interface for Recipe Clipper for Notion.
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
 *
 * @returns The current origin URL (works for both localhost and production).
 */
function getServerUrl(): string {
	return window.location.origin;
}

/**
 * Storage adapter for this interface.
 */
const storage = createStorageAdapter();

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
 * Handles the save button click event.
 *
 * Validates the URL and initiates recipe saving with progress updates.
 */
async function handleSave(): Promise<void> {
	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	const url = urlInput?.value.trim();

	if (!url) {
		updateStatus("Please enter a recipe URL", "error");
		return;
	}

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
		} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
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
 *
 * Shows or hides the settings accordion and updates the chevron icon rotation.
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
 *
 * Shows a formatted card with recipe details and a link to the Notion page.
 *
 * @param data - The recipe data including page ID, URL, recipe details, and tags.
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
 *
 * Called when the settings panel is opened.
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
 *
 * Validates that the API key is not empty before saving.
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
 *
 * Used for iOS Shortcuts and other sharing integrations.
 * Validates that the URL is actually a valid URL before using it.
 */
function handleQueryParameters(): void {
	const urlParams = new URLSearchParams(window.location.search);
	const url = urlParams.get("url");

	if (url) {
		try {
			new URL(url);
			const urlInput = document.getElementById("url-input") as HTMLInputElement;
			if (urlInput) {
				urlInput.value = url;
				storage.getApiKey().then((apiKey) => {
					if (apiKey) {
						setTimeout(() => {
							handleSave();
						}, 300);
					}
				});
			}
		} catch {
			console.warn("Invalid URL in query parameters:", url);
		}
	}
}

/**
 * Handles Web Share Target API (for Android Chrome).
 *
 * The share data is passed via URL parameters, which are already handled
 * by handleQueryParameters().
 */
function handleWebShareTarget(): void {
	// Web Share Target data is handled via URL parameters in handleQueryParameters()
}

/**
 * Initializes the web interface.
 *
 * Sets up event listeners, handles query parameters, and checks API key configuration.
 */
async function init(): Promise<void> {
	const saveButton = document.getElementById("save-button");
	if (saveButton) {
		saveButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			handleSave();
		});
	} else {
		console.error("Save button not found during init");
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

	setupApiKeyVisibilityToggle();

	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	if (urlInput) {
		urlInput.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				handleSave();
			}
		});
		urlInput.focus();
	}

	handleQueryParameters();
	handleWebShareTarget();

	const apiKey = await storage.getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API secret not configured. Click Settings to set it up.", "error");
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
