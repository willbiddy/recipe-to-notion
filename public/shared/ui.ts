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
 * CSS class constants using theme-based semantic names.
 */
const STATUS_CLASSES = {
	BASE: "py-4 px-5 rounded-2xl leading-relaxed animate-[fadeIn_0.2s_ease-in] block shadow-sm",
	TEXT_SIZES: {
		xs: "text-xs",
		sm: "text-sm",
		base: "text-base",
	},
	INFO: "status-info",
	SUCCESS: "status-success",
	ERROR: "status-error",
} as const;

/**
 * Gets the icon SVG for a status type.
 *
 * @param type - The type of status (info, success, or error).
 * @returns SVG string for the icon.
 */
function getStatusIcon(type: "info" | "success" | "error"): string {
	const icons = {
		info: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>`,
		success: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>`,
		error: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>`,
	};
	return icons[type];
}

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

	const textSize = options?.textSize ?? "sm";
	const textSizeClass = STATUS_CLASSES.TEXT_SIZES[textSize];

	const baseClasses = options?.baseClasses || `${STATUS_CLASSES.BASE} ${textSizeClass}`;
	const typeClasses = {
		info: STATUS_CLASSES.INFO,
		success: STATUS_CLASSES.SUCCESS,
		error: STATUS_CLASSES.ERROR,
	};

	const icon = getStatusIcon(type);
	const isHTML = message.includes("<") && message.includes(">");

	if (isHTML) {
		statusEl.innerHTML = `<div class="flex items-start gap-3">${icon}<div class="flex-1">${message}</div></div>`;
	} else {
		statusEl.innerHTML = `<div class="flex items-start gap-3">${icon}<div class="flex-1">${message}</div></div>`;
	}

	statusEl.className = `${baseClasses} ${typeClasses[type]}`;
	statusEl.classList.remove("hidden");
}

/**
 * Clears the status message from the UI.
 */
export function clearStatus(): void {
	const statusEl = document.getElementById(UI_ELEMENT_IDS.STATUS);
	if (statusEl) {
		statusEl.classList.add("hidden");
		statusEl.textContent = "";
		statusEl.innerHTML = "";
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

	// Add spinner to button when loading
	const existingSpinner = saveButton.querySelector(".button-spinner");
	if (loading && !existingSpinner) {
		const spinner = document.createElement("div");
		spinner.className =
			"button-spinner w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0";
		spinner.setAttribute("aria-hidden", "true");
		const checkIcon = saveButton.querySelector("svg");
		if (checkIcon) {
			checkIcon.replaceWith(spinner);
		}
	} else if (!loading && existingSpinner) {
		const checkIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		checkIcon.setAttribute(
			"class",
			"w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200",
		);
		checkIcon.setAttribute("fill", "none");
		checkIcon.setAttribute("stroke", "currentColor");
		checkIcon.setAttribute("viewBox", "0 0 24 24");
		checkIcon.setAttribute("aria-hidden", "true");
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("stroke-linecap", "round");
		path.setAttribute("stroke-linejoin", "round");
		path.setAttribute("stroke-width", "2");
		path.setAttribute("d", "M5 13l4 4L19 7");
		checkIcon.appendChild(path);
		existingSpinner.replaceWith(checkIcon);
	}
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
