/**
 * Web interface entry point for recipe-to-notion.
 * Mounts the Solid.js WebRecipeForm component.
 */

import { WebRecipeForm } from "@shared/components/web-recipe-form.js";
import { StorageProvider } from "@shared/contexts/storage-context.js";
import { ThemeProvider } from "@shared/contexts/theme-context.js";
import { render } from "solid-js/web";

const mainContent = document.getElementById("main-content");

if (mainContent) {
	render(
		() => (
			<StorageProvider>
				<ThemeProvider>
					<WebRecipeForm />
				</ThemeProvider>
			</StorageProvider>
		),
		mainContent,
	);
} else {
	console.error("Main content element not found");
}
