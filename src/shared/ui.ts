/**
 * Shared UI utility functions for both web and extension interfaces.
 */

/**
 * Element IDs used throughout the UI.
 */
const UI_ELEMENT_IDS = {
	STATUS: "status",
	PROGRESS_CONTAINER: "progress-container",
	PROGRESS_MESSAGE: "progress-message",
	SAVE_BUTTON: "save-button",
	BUTTON_TEXT: "button-text",
	TOGGLE_VISIBILITY_BUTTON: "toggle-api-key-visibility",
	API_KEY_INPUT: "api-key-input",
	EYE_ICON: "eye-icon",
	EYE_OFF_ICON: "eye-off-icon",
} as const;

/**
 * Button text states.
 */
const BUTTON_TEXT = {
	LOADING: "Processing...",
	NORMAL: "Save Recipe",
} as const;

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
	const statusEl = document.getElementById(UI_ELEMENT_IDS.STATUS);
	if (!statusEl) {
		return;
	}

	statusEl.textContent = message;
	statusEl.classList.remove("hidden");

	const textSize = options?.textSize ?? "sm";
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
	const statusEl = document.getElementById(UI_ELEMENT_IDS.STATUS);
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
	const progressContainer = document.getElementById(UI_ELEMENT_IDS.PROGRESS_CONTAINER);
	const progressMessage = document.getElementById(UI_ELEMENT_IDS.PROGRESS_MESSAGE);
	if (!progressContainer || !progressMessage) {
		return;
	}

	progressMessage.textContent = message;
	progressContainer.classList.remove("hidden");
}

/**
 * Hides the progress indicator from the UI.
 */
export function hideProgress(): void {
	const progressContainer = document.getElementById(UI_ELEMENT_IDS.PROGRESS_CONTAINER);
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
	const saveButton = document.getElementById(UI_ELEMENT_IDS.SAVE_BUTTON) as HTMLButtonElement;
	const buttonText = saveButton?.querySelector(`.${UI_ELEMENT_IDS.BUTTON_TEXT}`) as HTMLElement;
	if (!saveButton || !buttonText) {
		return;
	}

	saveButton.disabled = loading;
	buttonText.textContent = loading ? BUTTON_TEXT.LOADING : BUTTON_TEXT.NORMAL;
}

/**
 * Sets up the API key visibility toggle button.
 *
 * Allows users to show/hide the API key input field.
 */
export function setupApiKeyVisibilityToggle(): void {
	const toggleVisibilityButton = document.getElementById(UI_ELEMENT_IDS.TOGGLE_VISIBILITY_BUTTON);
	const apiKeyInput = document.getElementById(UI_ELEMENT_IDS.API_KEY_INPUT) as HTMLInputElement;
	const eyeIcon = document.getElementById(UI_ELEMENT_IDS.EYE_ICON);
	const eyeOffIcon = document.getElementById(UI_ELEMENT_IDS.EYE_OFF_ICON);

	if (!toggleVisibilityButton || !apiKeyInput || !eyeIcon || !eyeOffIcon) {
		return;
	}

	toggleVisibilityButton.addEventListener("click", () => {
		const isPassword = apiKeyInput.type === "password";
		apiKeyInput.type = isPassword ? "text" : "password";
		eyeIcon.classList.toggle("hidden", !isPassword);
		eyeOffIcon.classList.toggle("hidden", isPassword);
	});
}
