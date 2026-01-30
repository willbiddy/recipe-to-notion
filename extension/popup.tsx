/**
 * Extension popup entry point for recipe-to-notion.
 * Mounts the Solid.js ExtensionRecipeForm component.
 */

import { ExtensionRecipeForm } from "@shared/components/extension-recipe-form";
import { DOM_SELECTORS, ExtensionMessageType } from "@shared/constants";
import { StorageProvider } from "@shared/contexts/storage-context";
import { ThemeProvider } from "@shared/contexts/theme-context";
import { detectSystemTheme } from "@shared/hooks/use-theme";
import { render } from "solid-js/web";
import { getServerUrl } from "./config";

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

const card = document.querySelector(DOM_SELECTORS.Card);

if (card) {
	render(
		() => (
			<StorageProvider>
				<ThemeProvider>
					<ExtensionRecipeForm getServerUrl={getServerUrl} />
				</ThemeProvider>
			</StorageProvider>
		),
		card,
	);
} else {
	console.error("Card element not found");
}
