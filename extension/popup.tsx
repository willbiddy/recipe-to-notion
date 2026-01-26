/**
 * Extension popup entry point for recipe-to-notion.
 * Mounts the Solid.js ExtensionRecipeForm component.
 */

import { render } from "solid-js/web";
import { ExtensionRecipeForm } from "../src/shared/components/ExtensionRecipeForm.tsx";
import { getServerUrl } from "./config.js";

// Mount the component to the card element
const card = document.querySelector(".card");

if (card) {
	render(() => <ExtensionRecipeForm getServerUrl={getServerUrl} />, card);
} else {
	console.error("Card element not found");
}
