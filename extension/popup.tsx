/**
 * Extension popup entry point for recipe-to-notion.
 * Mounts the Solid.js ExtensionRecipeForm component.
 */

import { render } from "solid-js/web";
import { ExtensionRecipeForm } from "../src/shared/components/extension-recipe-form.tsx";
import { getServerUrl } from "./config.js";

/**
 * Detects the current system theme preference.
 */
function detectTheme(): "light" | "dark" {
	if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
		return "dark";
	}
	return "light";
}

/**
 * Updates the extension icon based on the current theme.
 */
async function updateExtensionIcon() {
	const theme = detectTheme();

	// Store theme preference
	await chrome.storage.local.set({ theme });

	// Notify background script to update icon
	chrome.runtime.sendMessage({ type: "theme-changed", theme });
}

// Update icon when popup opens
updateExtensionIcon();

// Listen for theme changes while popup is open
if (window.matchMedia) {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	mediaQuery.addEventListener("change", updateExtensionIcon);
}

// Mount the component to the card element
const card = document.querySelector(".card");

if (card) {
	render(() => <ExtensionRecipeForm getServerUrl={getServerUrl} />, card);
} else {
	console.error("Card element not found");
}
