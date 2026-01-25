/**
 * Shared UI utility functions for both web and extension interfaces.
 */

/**
 * Status types for updateStatus function.
 */
export enum StatusType {
	INFO = "info",
	SUCCESS = "success",
	ERROR = "error",
}

/**
 * Text size options for status messages.
 */
export enum TextSize {
	XS = "xs",
	SM = "sm",
	BASE = "base",
}

/**
 * CSS class constants using theme-based semantic names.
 */
const STATUS_CLASSES = {
	BASE: "py-4 px-5 rounded-2xl leading-relaxed animate-[fadeIn_0.2s_ease-in] block shadow-sm",
	TEXT_SIZES: {
		[TextSize.XS]: "text-xs",
		[TextSize.SM]: "text-sm",
		[TextSize.BASE]: "text-base",
	},
	INFO: "status-info",
	SUCCESS: "status-success",
	ERROR: "status-error",
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
	type: StatusType = StatusType.INFO,
	options?: {
		baseClasses?: string;
		textSize?: TextSize;
	},
): void {
	const statusEl = document.getElementById("status");

	if (!statusEl) {
		return;
	}

	statusEl.textContent = message;
	statusEl.classList.remove("hidden");

	const textSize = options?.textSize ?? TextSize.SM;
	const textSizeClass = STATUS_CLASSES.TEXT_SIZES[textSize];

	const baseClasses = options?.baseClasses || `${STATUS_CLASSES.BASE} ${textSizeClass}`;
	const typeClasses = {
		[StatusType.INFO]: STATUS_CLASSES.INFO,
		[StatusType.SUCCESS]: STATUS_CLASSES.SUCCESS,
		[StatusType.ERROR]: STATUS_CLASSES.ERROR,
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
	const buttonText = saveButton?.querySelector(".button-text") as HTMLElement;

	if (!saveButton || !buttonText) {
		return;
	}

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
