/**
 * Web interface for Recipe to Notion.
 * Handles API key management, URL submission, and SSE progress updates.
 */

/**
 * Response format from the server API.
 */
type RecipeResponse = {
	success: boolean;
	pageId?: string;
	notionUrl?: string;
	error?: string;
};

/**
 * Progress event from server.
 */
type ServerProgressEvent = {
	type: "progress" | "complete" | "error";
	message?: string;
	success?: boolean;
	pageId?: string;
	notionUrl?: string;
	error?: string;
};

/**
 * Gets the server URL from the current origin.
 */
function getServerUrl(): string {
	// Use the current origin (works for both localhost and production)
	return window.location.origin;
}

/**
 * Gets the API key from localStorage.
 */
function getApiKey(): string | null {
	const apiKey = localStorage.getItem("apiKey");
	return apiKey ? apiKey.trim() : null;
}

/**
 * Saves the API key to localStorage.
 */
function saveApiKey(apiKey: string): void {
	localStorage.setItem("apiKey", apiKey);
}

/**
 * Shows progress with spinner and message.
 */
function showProgress(message: string): void {
	const progressContainer = document.getElementById("progress-container");
	const progressMessage = document.getElementById("progress-message");
	if (!progressContainer || !progressMessage) return;

	progressMessage.textContent = message;
	progressContainer.classList.remove("hidden");
	setLoading(true);
}

/**
 * Hides the progress indicator.
 */
function hideProgress(): void {
	const progressContainer = document.getElementById("progress-container");
	if (progressContainer) {
		progressContainer.classList.add("hidden");
	}
}

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 */
// biome-ignore lint/suspicious/useAwait: Function returns a Promise but doesn't use await (manual Promise construction)
async function saveRecipe(url: string): Promise<RecipeResponse> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return {
			success: false,
			error: "API key not configured. Please set it in the settings.",
		};
	}

	const serverUrl = getServerUrl();
	const apiUrl = `${serverUrl}/api/recipes`;

	return new Promise((resolve, reject) => {
		try {
			/**
			 * Use Server-Sent Events for progress updates.
			 */
			fetch(apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({ url, stream: true }),
			})
				.then((response) => {
					if (!response.ok) {
						/**
						 * Try to parse as JSON for error details.
						 */
						return response
							.json()
							.then((errorData) => {
								resolve(errorData as RecipeResponse);
							})
							.catch(() => {
								resolve({
									success: false,
									error: `Server error: ${response.status} ${response.statusText}`,
								});
							});
					}

					/**
					 * Read SSE stream.
					 */
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();

					if (!reader) {
						resolve({
							success: false,
							error: "Failed to read response stream",
						});
						return;
					}

					let buffer = "";

					const readChunk = (): Promise<void> => {
						// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE parsing logic is inherently complex
						return reader.read().then(({ done, value }) => {
							if (done) {
								resolve({
									success: false,
									error: "Stream ended unexpectedly",
								});
								return;
							}

							buffer += decoder.decode(value, { stream: true });
							const lines = buffer.split("\n");
							buffer = lines.pop() || "";

							for (const line of lines) {
								if (line.startsWith("data: ")) {
									try {
										const data = JSON.parse(line.slice(6)) as ServerProgressEvent;

										if (data.type === "progress") {
											showProgress(data.message || "Processing...");
										} else if (data.type === "complete") {
											hideProgress();
											resolve({
												success: data.success || false,
												pageId: data.pageId,
												notionUrl: data.notionUrl,
											});
											return;
										} else if (data.type === "error") {
											hideProgress();
											resolve({
												success: false,
												error: data.error || "Unknown error",
												notionUrl: data.notionUrl,
											});
											return;
										}
									} catch (_e) {
										/**
										 * Ignore parse errors for malformed events.
										 */
									}
								}
							}

							return readChunk();
						});
					};

					readChunk().catch((error) => {
						hideProgress();
						reject(error);
					});
				})
				.catch((error) => {
					hideProgress();
					/**
					 * Network error - server might not be running.
					 */
					if (error instanceof TypeError && error.message.includes("fetch")) {
						resolve({
							success: false,
							error: `Cannot connect to server at ${serverUrl}.\n\nMake sure the server is running.`,
						});
					} else if (error instanceof TypeError) {
						/**
						 * Other network errors (CORS, timeout, etc.).
						 */
						resolve({
							success: false,
							error: `Connection error: ${error.message}`,
						});
					} else {
						resolve({
							success: false,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				});
		} catch (error) {
			hideProgress();
			reject(error);
		}
	});
}

/**
 * Updates the status message in the UI.
 */
function updateStatus(message: string, type: "info" | "success" | "error" = "info"): void {
	const statusEl = document.getElementById("status");
	if (!statusEl) return;

	statusEl.textContent = message;
	statusEl.classList.remove("hidden");
	const baseClasses =
		"py-4 px-5 rounded-2xl text-sm leading-relaxed animate-[fadeIn_0.2s_ease-in] block shadow-sm";
	const typeClasses = {
		info: "bg-orange-50 text-orange-800 border-2 border-orange-200",
		success: "bg-amber-50 text-amber-800 border-2 border-amber-300",
		error: "bg-red-50 text-red-800 border-2 border-red-200 whitespace-pre-line",
	};
	statusEl.className = `${baseClasses} ${typeClasses[type]}`;
}

/**
 * Clears the status message.
 */
function clearStatus(): void {
	const statusEl = document.getElementById("status");
	if (statusEl) {
		statusEl.classList.add("hidden");
		statusEl.textContent = "";
	}
}

/**
 * Sets the loading state of the save button.
 */
function setLoading(loading: boolean): void {
	const saveButton = document.getElementById("save-button") as HTMLButtonElement;
	const buttonText = saveButton?.querySelector(".button-text");
	if (!saveButton || !buttonText) return;

	saveButton.disabled = loading;
	buttonText.textContent = loading ? "Processing..." : "Save Recipe";
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
		const result = await saveRecipe(url);

		if (result.success && result.notionUrl) {
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
function loadApiKeyIntoInput(): void {
	const input = document.getElementById("api-key-input") as HTMLInputElement;
	if (!input) return;

	const apiKey = getApiKey();
	if (apiKey) {
		input.value = apiKey;
	} else {
		input.value = "";
	}
}

/**
 * Saves the API key to storage.
 */
function saveApiKeyToStorage(): void {
	const input = document.getElementById("api-key-input") as HTMLInputElement;
	if (!input) return;

	const apiKey = input.value.trim();
	if (!apiKey) {
		updateStatus("API key cannot be empty", "error");
		return;
	}

	try {
		saveApiKey(apiKey);
		updateStatus("API key saved successfully", "success");
		setTimeout(() => {
			clearStatus();
		}, 2000);
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "Failed to save API key", "error");
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
			const apiKey = getApiKey();
			if (apiKey) {
				// Small delay to ensure UI is ready
				setTimeout(() => {
					handleSave();
				}, 300);
			}
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
function init(): void {
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
	const toggleVisibilityButton = document.getElementById("toggle-api-key-visibility");
	const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
	const eyeIcon = document.getElementById("eye-icon");
	const eyeOffIcon = document.getElementById("eye-off-icon");

	if (toggleVisibilityButton && apiKeyInput && eyeIcon && eyeOffIcon) {
		toggleVisibilityButton.addEventListener("click", () => {
			const isPassword = apiKeyInput.type === "password";
			apiKeyInput.type = isPassword ? "text" : "password";
			eyeIcon.classList.toggle("hidden", !isPassword);
			eyeOffIcon.classList.toggle("hidden", isPassword);
		});
	}

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
	const apiKey = getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API key not configured. Click Settings to set it up.", "error");
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
