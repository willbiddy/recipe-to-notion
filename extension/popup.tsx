/**
 * Extension popup entry point for recipe-to-notion.
 * Mounts the Solid.js ExtensionRecipeForm component.
 */

import { render } from "solid-js/web";
import { ExtensionRecipeForm } from "../shared/components/extension-recipe-form.js";
import { ExtensionMessageType, Theme } from "../shared/constants.js";
import { getServerUrl } from "./config.js";

/**
 * Detects the current system theme preference.
 *
 * @returns The detected theme (light or dark).
 */
function detectTheme(): Theme {
	if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
		return Theme.Dark;
	}
	return Theme.Light;
}

/**
 * Updates the extension icon based on the current theme.
 */
async function updateExtensionIcon(): Promise<void> {
	const theme = detectTheme();
	await chrome.storage.local.set({ theme });
	chrome.runtime.sendMessage({ type: ExtensionMessageType.ThemeChanged, theme });
}

updateExtensionIcon();

if (window.matchMedia) {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	mediaQuery.addEventListener("change", updateExtensionIcon);
}

const card = document.querySelector(".card");

if (card) {
	render(() => <ExtensionRecipeForm getServerUrl={getServerUrl} />, card);
} else {
	console.error("Card element not found");
}
