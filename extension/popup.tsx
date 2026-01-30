/**
 * Extension popup entry point for recipe-to-notion.
 * Mounts the Solid.js ExtensionRecipeForm component.
 */

import { ExtensionRecipeForm } from "@shared/components/extension-recipe-form.js";
import { ExtensionMessageType } from "@shared/constants.js";
import { ThemeProvider } from "@shared/contexts/theme-context.js";
import { detectSystemTheme } from "@shared/utils/theme-utils.js";
import { render } from "solid-js/web";
import { getServerUrl } from "./config.js";

/**
 * Updates the extension icon based on the current theme.
 */
function updateExtensionIcon(): void {
	const theme = detectSystemTheme();
	chrome.runtime.sendMessage({ type: ExtensionMessageType.ThemeChanged, theme });
}

updateExtensionIcon();

if (window.matchMedia) {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	mediaQuery.addEventListener("change", updateExtensionIcon);
}

const card = document.querySelector(".card");

if (card) {
	render(
		() => (
			<ThemeProvider>
				<ExtensionRecipeForm getServerUrl={getServerUrl} />
			</ThemeProvider>
		),
		card,
	);
} else {
	console.error("Card element not found");
}
