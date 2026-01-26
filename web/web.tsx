/**
 * Web interface entry point for recipe-to-notion.
 * Mounts the Solid.js WebRecipeForm component.
 */

import { render } from "solid-js/web";
import { WebRecipeForm } from "../shared/components/web-recipe-form.js";

const mainContent = document.getElementById("main-content");

if (mainContent) {
	render(() => <WebRecipeForm />, mainContent);
} else {
	console.error("Main content element not found");
}
