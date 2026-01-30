/**
 * Web interface entry point for recipe-to-notion.
 * Mounts the Solid.js WebRecipeForm component.
 */

import { WebRecipeForm } from "@shared/components/web-recipe-form";
import { StorageProvider } from "@shared/contexts/storage-context";
import { ThemeProvider } from "@shared/contexts/theme-context";
import { render } from "solid-js/web";

const mainContent: HTMLElement | null = document.getElementById("main-content");

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
