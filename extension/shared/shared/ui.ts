/**
 * Shared UI utility functions for both web and extension interfaces.
 */

/**
 * Updates the status message in the UI.
 *
 * @param message - The status message to display.
 * @param type - The type of status (info, success, or error).
 * @param options - Optional configuration for text size and base classes.
 */
export function updateStatus(
	message: string,
	type: "info" | "success" | "error" = "info",
	options?: {
		baseClasses?: string;
		textSize?: "sm" | "base" | "xs";
	},
): void {
	const statusEl = document.getElementById("status");
	if (!statusEl) return;

	statusEl.textContent = message;
	statusEl.classList.remove("hidden");

	const textSize = options?.textSize || "sm";
	const textSizeClass =
		textSize === "xs" ? "text-xs" : textSize === "base" ? "text-base" : "text-sm";

	const baseClasses =
		options?.baseClasses ||
		`py-4 px-5 rounded-2xl ${textSizeClass} leading-relaxed animate-[fadeIn_0.2s_ease-in] block shadow-sm`;
	const typeClasses = {
		info: "bg-orange-50 text-orange-800 border-2 border-orange-200",
		success: "bg-amber-50 text-amber-800 border-2 border-amber-300",
		error: "bg-red-50 text-red-800 border-2 border-red-200 whitespace-pre-line",
	};
	statusEl.className = `${baseClasses} ${typeClasses[type]}`;
}

/**
 * Clears the status message from the UI.
 */
export function clearStatus(): void {
	const statusEl = document.getElementById("status");
	if (statusEl) {
		statusEl.classList.add("hidden");
		statusEl.textContent = "";
	}
}

/**
 * Shows progress indicator with spinner and message.
 *
 * @param message - The progress message to display.
 */
export function showProgress(message: string): void {
	const progressContainer = document.getElementById("progress-container");
	const progressMessage = document.getElementById("progress-message");
	if (!progressContainer || !progressMessage) return;

	progressMessage.textContent = message;
	progressContainer.classList.remove("hidden");
}

/**
 * Hides the progress indicator from the UI.
 */
export function hideProgress(): void {
	const progressContainer = document.getElementById("progress-container");
	if (progressContainer) {
		progressContainer.classList.add("hidden");
	}
}

/**
 * Sets the loading state of the save button.
 *
 * @param loading - True to show loading state, false to show normal state.
 */
export function setLoading(loading: boolean): void {
	const saveButton = document.getElementById("save-button") as HTMLButtonElement;
	const buttonText = saveButton?.querySelector(".button-text");
	if (!saveButton || !buttonText) return;

	saveButton.disabled = loading;
	buttonText.textContent = loading ? "Processing..." : "Save Recipe";
}

/**
 * Sets up the API key visibility toggle button.
 *
 * Allows users to show/hide the API key input field.
 */
export function setupApiKeyVisibilityToggle(): void {
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
}
