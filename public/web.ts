/**
 * Web interface for recipe-to-notion.
 * Handles API key management, URL submission, and SSE progress updates.
 */

import { saveRecipe } from "./shared/api.js";
import { createStorageAdapter } from "./shared/storage.js";
import {
	clearStatus,
	hideProgress,
	StatusType,
	setLoading,
	setupApiKeyVisibilityToggle,
	showProgress,
	updateStatus,
} from "./shared/ui.js";

/**
 * Delay before auto-submitting URL from query parameters (milliseconds).
 */
const AUTO_SUBMIT_DELAY_MS = 300;

/**
 * Delay before clearing success status (milliseconds).
 */
const SUCCESS_STATUS_CLEAR_DELAY_MS = 2000;

/**
 * Delay before clearing URL input after successful save (milliseconds).
 */
const CLEAR_URL_INPUT_DELAY_MS = 500;

/**
 * Animation duration for settings panel (milliseconds).
 */
const SETTINGS_ANIMATION_DURATION_MS = 300;

/**
 * Delay before retrying to find DOM elements (milliseconds).
 */
const DOM_RETRY_DELAY_MS = 100;

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
		updateStatus("Please enter a recipe URL", StatusType.ERROR);
		return;
	}

	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		updateStatus("Not a valid web page URL. Must start with http:// or https://", StatusType.ERROR);
		return;
	}

	clearStatus();
	setLoading(true);
	showProgress("Starting...");

	try {
		const result = await saveRecipeWithProgress(url);

		if (result.success) {
			// Recipe info is displayed in displayRecipeInfo callback
			// Clear the URL input after successful save
			const urlInput = document.getElementById("url-input") as HTMLInputElement;

			if (urlInput) {
				setTimeout(() => {
					urlInput.value = "";
					updateUrlValidationState("");
				}, CLEAR_URL_INPUT_DELAY_MS);
			}
		} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
			updateStatus(
				`This recipe already exists. <a href="${result.notionUrl}" target="_blank" class="underline font-semibold">Open in Notion</a>`,
				StatusType.INFO,
			);
		} else {
			updateStatus(result.error || "Failed to save recipe", StatusType.ERROR);
		}
	} catch (error) {
		updateStatus(
			error instanceof Error ? error.message : "An unexpected error occurred",
			StatusType.ERROR,
		);
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
		// Trigger animation
		requestAnimationFrame(() => {
			settingsPanel.classList.add("animate-slide-down");
		});
		// Load API key asynchronously without blocking the UI
		loadApiKeyIntoInput().catch((error) => {
			console.error("Error loading API key:", error);
		});
	} else {
		settingsPanel.classList.remove("animate-slide-down");
		settingsButton.setAttribute("aria-expanded", "false");
		if (chevron) {
			chevron.style.transform = "rotate(0deg)";
		}
		// Wait for animation to complete before hiding
		setTimeout(() => {
			settingsPanel.classList.add("hidden");
		}, SETTINGS_ANIMATION_DURATION_MS);
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

	if (!statusDiv) {
		return;
	}

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
	const notionLink = `<a href="${data.notionUrl}" target="_blank" class="font-semibold underline hover:text-primary-900 transition-colors">${recipeTitle}</a>`;

	statusDiv.innerHTML = `
		<div class="bg-gradient-to-br from-success-50 to-emerald-50 border-2 border-success-300 rounded-2xl p-5 space-y-3">
			<div class="flex items-center gap-3 mb-2">
				<svg class="w-6 h-6 text-success-600 animate-checkmark flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<h3 class="text-lg font-bold text-success-900">${recipeTitle}</h3>
			</div>
			<div class="space-y-2 text-sm text-success-800">
				${infoLines.map((line) => `<div>${line}</div>`).join("")}
			</div>
			<div class="pt-3 border-t border-success-200">
				<p class="text-sm text-success-900">
					Recipe saved! Open in Notion: ${notionLink}
				</p>
			</div>
		</div>
	`;

	statusDiv.className =
		"py-4 px-5 rounded-2xl text-sm leading-relaxed animate-[fadeIn_0.2s_ease-in] shadow-sm";
	statusDiv.classList.remove("hidden");
}

/**
 * Loads the API key from storage into the input field.
 *
 * Called when the settings panel is opened.
 */
async function loadApiKeyIntoInput(): Promise<void> {
	const input = document.getElementById("api-key-input") as HTMLInputElement;

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
async function saveApiKeyToStorage(): Promise<void> {
	const input = document.getElementById("api-key-input") as HTMLInputElement;

	if (!input) {
		return;
	}

	const apiKey = input.value.trim();
	if (!apiKey) {
		updateStatus("API secret cannot be empty", StatusType.ERROR);
		return;
	}

	try {
		await storage.saveApiKey(apiKey);
		updateStatus("API secret saved successfully", StatusType.SUCCESS);
		setTimeout(() => {
			clearStatus();
		}, SUCCESS_STATUS_CLEAR_DELAY_MS);
	} catch (error) {
		updateStatus(
			error instanceof Error ? error.message : "Failed to save API secret",
			StatusType.ERROR,
		);
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
						}, AUTO_SUBMIT_DELAY_MS);
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

/**
 * Keyboard modifier keys.
 */
const _MODIFIER_KEYS = {
	META: "Meta",
	CONTROL: "Control",
} as const;

/**
 * Validates a URL and updates the UI accordingly.
 *
 * @param url - The URL to validate.
 * @returns True if the URL is valid, false otherwise.
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
 * Updates the URL input validation state and clear button visibility.
 *
 * @param url - The current URL value.
 */
function updateUrlValidationState(url: string): void {
	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	const clearButton = document.getElementById("clear-url-button") as HTMLButtonElement;
	const validationDiv = document.getElementById("url-validation");

	if (!urlInput || !clearButton) {
		return;
	}

	const trimmedUrl = url.trim();
	const isValid = validateUrl(trimmedUrl);
	const hasValue = trimmedUrl.length > 0;

	// Show/hide clear button
	if (hasValue) {
		clearButton.style.display = "flex";
		clearButton.tabIndex = 0;
	} else {
		clearButton.style.display = "none";
		clearButton.tabIndex = -1;
	}

	// Update validation state
	if (hasValue) {
		urlInput.setAttribute("aria-invalid", isValid ? "false" : "true");
		if (validationDiv) {
			validationDiv.textContent = isValid ? "Valid URL" : "Invalid URL format";
		}
	} else {
		urlInput.setAttribute("aria-invalid", "false");
		if (validationDiv) {
			validationDiv.textContent = "";
		}
	}
}

/**
 * Clears the URL input field.
 */
function clearUrlInput(): void {
	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	if (urlInput) {
		urlInput.value = "";
		urlInput.focus();
		updateUrlValidationState("");
		clearStatus();
	}
}

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
		const handleSettingsClick = (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
			try {
				toggleSettings();
			} catch (error) {
				console.error("Error toggling settings:", error);
			}
		};

		settingsButton.addEventListener("click", handleSettingsClick, { passive: false });
	} else {
		console.error("Settings button not found during init");
		// Retry after a short delay in case DOM isn't fully ready
		setTimeout(() => {
			const retryButton = document.getElementById("settings-button");
			if (retryButton) {
				retryButton.addEventListener(
					"click",
					(e) => {
						e.preventDefault();
						e.stopPropagation();
						try {
							toggleSettings();
						} catch (error) {
							console.error("Error toggling settings:", error);
						}
					},
					{ passive: false },
				);
			} else {
				console.error("Settings button still not found after retry");
			}
		}, DOM_RETRY_DELAY_MS);
	}

	const saveApiKeyButton = document.getElementById("save-api-key-button");
	if (saveApiKeyButton) {
		saveApiKeyButton.addEventListener("click", saveApiKeyToStorage);
	}

	setupApiKeyVisibilityToggle();

	const urlInput = document.getElementById("url-input") as HTMLInputElement;
	if (urlInput) {
		// Real-time URL validation
		urlInput.addEventListener("input", (e) => {
			const value = (e.target as HTMLInputElement).value;
			updateUrlValidationState(value);
		});

		// Keyboard shortcuts: Enter to submit, Cmd/Ctrl+Enter also submits
		urlInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				if (e.metaKey || e.ctrlKey) {
					e.preventDefault();
					handleSave();
				} else {
					// Regular Enter also submits
					e.preventDefault();
					handleSave();
				}
			}
		});

		// Clear button functionality
		const clearButton = document.getElementById("clear-url-button");
		if (clearButton) {
			clearButton.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				clearUrlInput();
			});
		}

		// Initial validation state
		updateUrlValidationState(urlInput.value);

		// Auto-focus on load
		urlInput.focus();
	}

	handleQueryParameters();
	handleWebShareTarget();

	const apiKey = await storage.getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API secret not configured. Click Settings to set it up.", StatusType.ERROR);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
