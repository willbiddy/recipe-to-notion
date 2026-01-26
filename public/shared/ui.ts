/**
 * Shared UI utility functions for both web and extension interfaces.
 */

/**
 * Status types for updateStatus function.
 */
export enum StatusType {
	Info = "info",
	Success = "success",
	Error = "error",
}

/**
 * Text size options for status messages.
 */
export enum TextSize {
	Xs = "xs",
	Sm = "sm",
	Base = "base",
}

/**
 * CSS class constants using theme-based semantic names.
 */
const STATUS_CLASSES = {
	BASE: "py-4 px-5 rounded-2xl leading-relaxed animate-[fadeIn_0.2s_ease-in] block shadow-sm",
	TEXT_SIZES: {
		[TextSize.Xs]: "text-xs",
		[TextSize.Sm]: "text-sm",
		[TextSize.Base]: "text-base",
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
function getStatusIcon(type: StatusType): string {
	const icons = {
		[StatusType.Info]: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>`,
		[StatusType.Success]: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>`,
		[StatusType.Error]: `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
	type: StatusType = StatusType.Info,
	options?: {
		baseClasses?: string;
		textSize?: TextSize;
	},
): void {
	const statusEl = document.getElementById("status");

	if (!statusEl) {
		return;
	}

	const textSize = options?.textSize ?? TextSize.Sm;
	const textSizeClass = STATUS_CLASSES.TEXT_SIZES[textSize];

	const baseClasses = options?.baseClasses || `${STATUS_CLASSES.BASE} ${textSizeClass}`;
	const typeClasses = {
		[StatusType.Info]: STATUS_CLASSES.INFO,
		[StatusType.Success]: STATUS_CLASSES.SUCCESS,
		[StatusType.Error]: STATUS_CLASSES.ERROR,
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
	const statusEl = document.getElementById("status");

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
 * Updates button text and adds/removes a spinner icon based on loading state.
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
