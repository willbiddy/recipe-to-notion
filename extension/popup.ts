import { getServerUrl } from "./config.js";

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
 * Progress event from server.
 */
type ProgressEvent = {
	type: "progress" | "complete" | "error";
	message?: string;
	success?: boolean;
	pageId?: string;
	notionUrl?: string;
	error?: string;
};

/**
 * Shows progress with spinner and message.
 */
function showProgress(message: string): void {
	const progressContainer = document.getElementById("progress-container");
	const progressMessage = document.getElementById("progress-message");
	if (!progressContainer || !progressMessage) return;

	progressMessage.textContent = message;
	progressContainer.classList.remove("hidden");

	/**
	 * Update button to show simple loading state.
	 */
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
 * Gets the API key from storage.
 * Uses chrome.storage.local (not sync) to avoid syncing sensitive data to Google servers.
 */
async function getApiKey(): Promise<string | null> {
	const result = await chrome.storage.local.get("apiKey");
	const apiKey = result.apiKey;
	return typeof apiKey === "string" ? apiKey : null;
}

/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 */
async function saveRecipe(url: string): Promise<RecipeResponse> {
	const apiKey = await getApiKey();
	if (!apiKey) {
		return {
			success: false,
			error: "API key not configured. Please set it in the extension settings.",
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
								// Include the status code in the error message for debugging
								const errorMessage = errorData.error || errorData.message || "Unknown error";
								resolve({
									success: false,
									error: `Server error (${response.status}): ${errorMessage}`,
									...errorData,
								} as RecipeResponse);
							})
							.catch(async () => {
								// If JSON parsing fails, try to get text response
								const text = await response.text().catch(() => "");
								resolve({
									success: false,
									error: `Server error (${response.status}): ${response.statusText}${text ? ` - ${text}` : ""}`,
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
										const data = JSON.parse(line.slice(6)) as ProgressEvent;

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
							error: `Cannot connect to server at ${serverUrl}.\n\nMake sure the server is running:\n  bun run server`,
						});
					} else if (error instanceof TypeError) {
						/**
						 * Other network errors (CORS, timeout, etc.).
						 */
						resolve({
							success: false,
							error: `Connection error: ${error.message}\n\nCheck that the server is running: bun run server`,
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
 * Updates the UI to show the current page title.
 */
function updateUrlDisplay(url: string | null, title: string | null): void {
	const urlDisplay = document.getElementById("url-display");
	if (!urlDisplay) return;

	if (!url) {
		urlDisplay.textContent = "No URL found";
		urlDisplay.className =
			"text-[15px] text-red-600 p-3 bg-red-50 border border-red-200 rounded-md break-words leading-relaxed transition-all duration-200 font-medium text-left";
		return;
	}

	/**
	 * Validate it's an HTTP(S) URL.
	 */
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		urlDisplay.textContent = "Not a valid web page";
		urlDisplay.className =
			"text-[15px] text-red-600 p-3 bg-red-50 border border-red-200 rounded-md break-words leading-relaxed transition-all duration-200 font-medium text-left";
		return;
	}

	/**
	 * Show the page title if available, otherwise fall back to shortened URL.
	 */
	const trimmedTitle = title?.trim();
	if (trimmedTitle) {
		urlDisplay.textContent = trimmedTitle;
		urlDisplay.className =
			"text-[15px] text-gray-700 p-3 bg-gray-50 border border-gray-200 rounded-md break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-gray-100 hover:border-gray-300";
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
				"text-[15px] text-gray-700 p-3 bg-gray-50 border border-gray-200 rounded-md break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-gray-100 hover:border-gray-300";
			urlDisplay.title = url;
		} catch {
			urlDisplay.textContent = url;
			urlDisplay.className =
				"text-[15px] text-gray-700 p-3 bg-gray-50 border border-gray-200 rounded-md break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-gray-100 hover:border-gray-300";
		}
	}
}

/**
 * Updates the status message in the UI.
 */
function updateStatus(message: string, type: "info" | "success" | "error" = "info"): void {
	const statusEl = document.getElementById("status");
	if (!statusEl) return;

	statusEl.textContent = message;
	const baseClasses =
		"py-3 px-4 rounded-lg text-[13px] leading-relaxed animate-[fadeIn_0.2s_ease-in] block";
	const typeClasses = {
		info: "bg-blue-50 text-blue-800 border border-blue-200",
		success: "bg-green-50 text-green-800 border border-green-200",
		error: "bg-red-50 text-red-800 border border-red-200 whitespace-pre-line",
	};
	statusEl.className = `${baseClasses} ${typeClasses[type]}`;
}

/**
 * Clears the status message.
 */
function clearStatus(): void {
	const statusEl = document.getElementById("status");
	if (statusEl) {
		statusEl.style.display = "none";
		statusEl.textContent = "";
		statusEl.className = "status";
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
	const { url } = await getCurrentTab();
	if (!url) {
		updateStatus("No URL found. Please navigate to a recipe page.", "error");
		return;
	}

	/**
	 * Validate URL.
	 */
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		updateStatus("Not a valid web page URL.", "error");
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
				updateStatus("Opening...", "info");
				setTimeout(() => {
					chrome.tabs.create({ url: result.notionUrl });
				}, 500);
			}, 500);
		} else if (result.error?.includes("Duplicate recipe found") && result.notionUrl) {
			/**
			 * Handle duplicate errors specially.
			 */
			updateStatus(`This recipe already exists. Opening...`, "info");
			setTimeout(() => {
				chrome.tabs.create({ url: result.notionUrl });
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
async function loadApiKeyIntoInput(): Promise<void> {
	const input = document.getElementById("api-key-input") as HTMLInputElement;
	if (!input) return;

	const apiKey = await getApiKey();
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
		updateStatus("API key cannot be empty", "error");
		return;
	}

	try {
		// Use chrome.storage.local instead of sync to avoid syncing sensitive API key to Google servers
		await chrome.storage.local.set({ apiKey });
		updateStatus("API key saved successfully", "success");
		setTimeout(() => {
			clearStatus();
		}, 2000);
	} catch (error) {
		updateStatus(error instanceof Error ? error.message : "Failed to save API key", "error");
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
	 * Check if API key is configured and show warning if not.
	 */
	const apiKey = await getApiKey();
	if (!apiKey) {
		updateStatus("⚠️ API key not configured. Click the settings icon to set it up.", "error");
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
