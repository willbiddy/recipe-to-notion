/**
 * Extension popup entry point for recipe-to-notion.
 * Mounts the Solid.js ExtensionRecipeForm component.
 */

import { ExtensionRecipeForm } from "@shared/components/extension-recipe-form";
import { DOM_SELECTORS } from "@shared/constants";
import { StorageProvider } from "@shared/contexts/storage-context";
import { ThemeProvider } from "@shared/contexts/theme-context";
import { createRoot } from "solid-js";
import { render } from "solid-js/web";
import { getServerUrl } from "./config";

const card = document.querySelector(DOM_SELECTORS.Card);

if (card) {
	createRoot(() => {
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
	});
} else {
	console.error("Card element not found");
}
