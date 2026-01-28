/**
 * Content script for extracting recipe data from pages.
 * Content scripts can import modules, so we can reuse the actual parser code.
 */

import { findRecipeInLd } from "../backend/parsers/json-ld.js";
import { cleanRecipeName } from "../backend/parsers/shared.js";
import { ExtensionMessageType } from "../shared/constants.js";
import { hasProperty, isArray, isObject, isString } from "../shared/type-guards.js";

/**
 * Browser-compatible HTML entity decoder using DOM API.
 * Replaces the Cheerio-based decodeHtmlEntities for browser contexts.
 */
function decodeHtmlEntitiesBrowser(str: string): string {
	const tempDiv = document.createElement("div");
	tempDiv.innerHTML = str;
	return tempDiv.textContent || tempDiv.innerText || str;
}

/**
 * Extracts author name from various JSON-LD author formats.
 * Matches the logic from backend/parsers/json-ld.ts parseAuthor function.
 */
function parseAuthor(author: unknown): string | null {
	if (!author) return null;

	if (isString(author)) return author;
	if (isArray(author)) {
		const first = author[0];
		if (isString(first)) return first;
		if (isObject(first) && hasProperty(first, "name")) {
			return String(first.name);
		}
	}

	if (isObject(author) && hasProperty(author, "name")) {
		return String(author.name);
	}
	return null;
}

/**
 * Extracts recipe title and author from JSON-LD structured data in the current page.
 * Uses the actual shared parser functions. Skips malformed JSON-LD blocks.
 */
function extractRecipeDataFromJsonLd(): { title: string | null; author: string | null } {
	try {
		const scripts = document.querySelectorAll('script[type="application/ld+json"]');
		for (const script of Array.from(scripts)) {
			try {
				const content = script.textContent;
				if (!content) continue;

				const data = JSON.parse(content);
				const recipe = findRecipeInLd(data);
				if (recipe?.name && isString(recipe.name)) {
					const decoded = decodeHtmlEntitiesBrowser(recipe.name);
					const cleaned = cleanRecipeName(decoded);
					const author = parseAuthor(recipe.author) ?? parseAuthor(recipe.publisher);

					return {
						title: cleaned || null,
						author: author || null,
					};
				}
			} catch {
				// Skip malformed JSON-LD block
			}
		}
	} catch {
		// Failed to extract recipe data
	}
	return { title: null, author: null };
}

/**
 * Listens for messages from the popup to extract recipe data.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === ExtensionMessageType.ExtractRecipeData) {
		const { title, author } = extractRecipeDataFromJsonLd();
		sendResponse({ title, author });
		return true; // Keep message channel open for async response
	}

	// Fallback handler to get page URL when tabs API fails
	if (message.type === ExtensionMessageType.GetPageUrl) {
		sendResponse({
			url: window.location.href,
			title: document.title,
		});
		return true;
	}

	return false;
});
