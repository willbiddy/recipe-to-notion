import type * as cheerio from "cheerio";
import { hasProperty, isArray, isObject, isString } from "../../shared/type-guards.js";
import { ParseError } from "../errors.js";
import type { ParsedRecipe } from "../scraper.js";
import { ScrapeMethod } from "../scraper.js";
import {
	cleanRecipeName,
	decodeHtmlEntities,
	filterEditorNotes,
	normalizeIngredient,
	parseDuration,
} from "./shared.js";

/**
 * Searches all `<script type="application/ld+json">` blocks for a Recipe object.
 *
 * Iterates through all JSON-LD script tags in the HTML and attempts
 * to parse them. If a Recipe object is found, extracts and returns
 * the recipe data. Skips malformed JSON-LD blocks.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param sourceUrl - Original URL of the recipe page.
 * @returns Parsed recipe data if found, null otherwise.
 */
export function parseJsonLd($: cheerio.CheerioAPI, sourceUrl: string): ParsedRecipe | null {
	const scripts = $('script[type="application/ld+json"]');
	for (let i = 0; i < scripts.length; i++) {
		try {
			const content = $(scripts[i]).html();
			if (!content) continue;

			const data = JSON.parse(content);
			const recipeData = findRecipeInLd(data);
			if (recipeData) {
				return extractFromJsonLd(recipeData, sourceUrl);
			}
		} catch {}
	}
	return null;
}

/**
 * Checks if an object is a Recipe type in JSON-LD format.
 *
 * Validates that the object has the @type property set to "Recipe" or contains
 * "Recipe" in an array of types. This is used to identify Recipe objects within
 * JSON-LD structures that may contain multiple schema.org types.
 *
 * @param data - The object to check for Recipe type.
 * @returns True if the object is identified as a Recipe type, false otherwise.
 */
export function isRecipeType(data: Record<string, unknown>): boolean {
	return data["@type"] === "Recipe" || (isArray(data["@type"]) && data["@type"].includes("Recipe"));
}

/**
 * Searches for Recipe in common nested patterns.
 *
 * @param data - The data object to search.
 * @param visited - Set of visited objects to prevent infinite loops.
 * @returns The Recipe object if found, null otherwise.
 */
function searchNestedPatterns(
	data: Record<string, unknown>,
	visited: WeakSet<object>,
): Record<string, unknown> | null {
	if (isArray(data["@graph"])) {
		const found = findRecipeInLd(data["@graph"], visited);
		if (found) return found;
	}

	const mainEntity = data.mainEntity ?? data.mainEntityOfPage;

	if (mainEntity) {
		const found = findRecipeInLd(mainEntity, visited);
		if (found) return found;
	}

	if (isArray(data.itemListElement)) {
		const found = findRecipeInLd(data.itemListElement, visited);
		if (found) return found;
	}

	return null;
}

/**
 * Recursively searches object properties for nested Recipe objects.
 *
 * @param data - The data object to search.
 * @param visited - Set of visited objects to prevent infinite loops.
 * @returns The Recipe object if found, null otherwise.
 */
function searchObjectProperties(
	data: Record<string, unknown>,
	visited: WeakSet<object>,
): Record<string, unknown> | null {
	for (const value of Object.values(data)) {
		if (isObject(value)) {
			const found = findRecipeInLd(value, visited);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Recursively searches a JSON-LD structure for an object with `@type: "Recipe"`.
 *
 * Handles various JSON-LD structures including top-level arrays,
 * `@graph` arrays, direct Recipe objects, and nested patterns like
 * WebPage containing Recipe in `mainEntity` or `mainEntityOfPage`,
 * ItemList containing Recipe objects, and other schema.org variations.
 * Uses a visited set to prevent infinite loops with circular references.
 *
 * @param data - The JSON-LD data structure to search.
 * @param visited - Set of visited objects to prevent infinite loops.
 * @returns The Recipe object if found, null otherwise.
 */
export function findRecipeInLd(
	data: unknown,
	visited = new WeakSet<object>(),
): Record<string, unknown> | null {
	if (!isObject(data)) return null;

	if (isArray(data)) {
		for (const item of data) {
			const found = findRecipeInLd(item, visited);
			if (found) return found;
		}
		return null;
	}

	if (visited.has(data)) return null;
	visited.add(data);

	if (isRecipeType(data)) {
		return data;
	}

	const nestedResult = searchNestedPatterns(data, visited);

	if (nestedResult) return nestedResult;

	return searchObjectProperties(data, visited);
}

/**
 * Maps a JSON-LD Recipe object to our internal ParsedRecipe type.
 *
 * Extracts and normalizes recipe data from a JSON-LD Recipe object,
 * handling various formats for time, servings, images, ingredients,
 * and instructions.
 *
 * @param data - The JSON-LD Recipe object.
 * @param sourceUrl - Original URL of the recipe page.
 * @returns A normalized ParsedRecipe object.
 */
function extractFromJsonLd(data: Record<string, unknown>, sourceUrl: string): ParsedRecipe {
	if (!data.name || typeof data.name !== "string") {
		throw new ParseError(
			`Recipe name is required but was missing or invalid in JSON-LD data from ${sourceUrl}`,
			sourceUrl,
		);
	}

	const author = parseAuthor(data.author) ?? parseAuthor(data.publisher);

	return {
		name: decodeHtmlEntities(cleanRecipeName(data.name)),
		sourceUrl,
		scrapeMethod: ScrapeMethod.JsonLd,
		author,
		totalTimeMinutes:
			parseDuration(data.totalTime as string | undefined) ??
			parseDuration(data.cookTime as string | undefined),
		servings: parseServings(data.recipeYield),
		imageUrl: parseImage(data.image),
		ingredients: parseStringArray(data.recipeIngredient),
		instructions: parseInstructions(data.recipeInstructions),
		description: isString(data.description) ? decodeHtmlEntities(data.description) : null,
		cuisine: parseFirstString(data.recipeCuisine),
		category: parseFirstString(data.recipeCategory),
	};
}

/**
 * Normalizes `recipeYield` (string, number, or array) into a display string.
 *
 * Handles various formats for recipe yield/servings data from JSON-LD,
 * converting numbers to display strings and extracting the first item
 * from arrays.
 *
 * @param recipeYield - The recipe yield data in various formats.
 * @returns A normalized serving string, or null if unavailable.
 */
function parseServings(recipeYield: unknown): string | null {
	if (!recipeYield) return null;

	if (isString(recipeYield)) return recipeYield;
	if (typeof recipeYield === "number") return `${recipeYield} servings`;
	if (isArray(recipeYield)) return String(recipeYield[0]);
	return null;
}

/**
 * Extracts author name from various JSON-LD `author` formats.
 *
 * Handles multiple author formats: direct string names, Person/Organization
 * objects with a `name` property, and arrays of authors (returns first).
 *
 * @param author - The author data in various JSON-LD formats.
 * @returns The author name string, or null if not found.
 */
function parseAuthor(author: unknown): string | null {
	if (!author) return null;

	if (isString(author)) return author;
	if (isArray(author)) {
		const first = author[0];
		if (isString(first)) return first;
		if (hasProperty(first, "name")) return String(first.name);
	}

	if (hasProperty(author, "name")) return String(author.name);
	return null;
}

/**
 * Extracts a URL from a single image item (string or ImageObject).
 *
 * @param item - A string URL or an object with a `url` property.
 * @returns The URL string, or null if not extractable.
 */
function extractImageUrl(item: unknown): string | null {
	if (isString(item)) return item;

	if (hasProperty(item, "url")) return String(item.url);
	return null;
}

/**
 * Finds the best image URL from an array of ImageObject items by width.
 *
 * @param imageArray - Array of ImageObject items.
 * @returns The URL of the image with the largest width, or null if not found.
 */
function findBestImageByWidth(imageArray: unknown[]): string | null {
	let bestUrl = "";
	let bestWidth = -1;
	for (const item of imageArray) {
		if (!hasProperty(item, "url") || !hasProperty(item, "width")) continue;
		const width = typeof item.width === "number" ? item.width : 0;
		if (width > bestWidth) {
			bestUrl = String(item.url);
			bestWidth = width;
		}
	}
	return bestUrl || null;
}

/**
 * Extracts the best (largest) image URL from JSON-LD `image` formats.
 *
 * Handles multiple image formats: direct string URLs, arrays of
 * strings, arrays of ImageObject objects with `url` properties,
 * and single ImageObject objects. When multiple images are available,
 * prefers the largest one (last in array, or highest width).
 *
 * @param image - The image data in various JSON-LD formats.
 * @returns The image URL string, or null if not found.
 */
function parseImage(image: unknown): string | null {
	if (!image) return null;

	if (isString(image)) return image;

	if (isArray(image) && image.length > 0) {
		const firstItem = image[0];
		if (hasProperty(firstItem, "url") && hasProperty(firstItem, "width")) {
			return findBestImageByWidth(image);
		}
		return extractImageUrl(image[image.length - 1]);
	}

	return extractImageUrl(image);
}

/**
 * Coerces unknown data into a string array (handles single string, array, or null).
 *
 * Normalizes various input formats into a consistent string array.
 * Handles single strings, arrays of strings, and null/undefined values.
 * Decodes HTML entities and normalizes parentheses in all strings.
 *
 * @param data - The data to convert to a string array.
 * @returns An array of strings, empty if input is null/undefined.
 */
function parseStringArray(data: unknown): string[] {
	if (!data) return [];

	if (isArray(data)) {
		return data.map((item) => normalizeIngredient(decodeHtmlEntities(String(item))));
	}

	if (isString(data)) {
		return [normalizeIngredient(decodeHtmlEntities(data))];
	}
	return [];
}

/**
 * Extracts a single string from data that may be a string or array.
 *
 * Used for fields like recipeCuisine and recipeCategory that can be
 * either a single string or an array of strings.
 *
 * @param data - The data to extract a string from.
 * @returns The first string value, or null if unavailable.
 */
function parseFirstString(data: unknown): string | null {
	if (!data) return null;

	if (isString(data)) return data;
	if (isArray(data) && data.length > 0) return String(data[0]);
	return null;
}

/**
 * Parses `recipeInstructions` which may be a plain string, an array of strings,
 * an array of HowToStep objects, or an array of HowToSection objects containing
 * nested itemListElement arrays.
 *
 * Handles the various instruction formats found in JSON-LD Recipe objects,
 * extracting text from nested structures and flattening the result.
 * Decodes HTML entities in all instruction text.
 *
 * When instructions are provided as a single string with line breaks,
 * splits them into separate steps.
 *
 * @param data - The instruction data in various formats.
 * @returns An array of instruction step strings.
 */
function parseInstructions(data: unknown): string[] {
	if (!data) return [];

	if (isString(data)) {
		const decoded = decodeHtmlEntities(data);
		// Split by line breaks if the string contains multiple steps
		const steps = decoded
			.split(/\n+/)
			.map((step) => step.trim())
			.filter((step) => step.length > 0);
		return filterEditorNotes(steps);
	}
	if (!isArray(data)) return [];

	const instructions = data.flatMap((item) => {
		if (isString(item)) return [decodeHtmlEntities(item)];
		if (isObject(item)) {
			// Check for itemListElement FIRST (HowToSection) before falling back to .text (HowToStep)
			if (isArray(item.itemListElement)) {
				return item.itemListElement.map((sub) => {
					if (isString(sub)) {
						return decodeHtmlEntities(sub);
					}
					if (isObject(sub) && hasProperty(sub, "text")) {
						return decodeHtmlEntities(String(sub.text));
					}
					return decodeHtmlEntities(String(sub));
				});
			}
			// Only use .text if there's no itemListElement (simple HowToStep)
			if (item.text) {
				return [decodeHtmlEntities(String(item.text))];
			}
		}
		return [];
	});

	return filterEditorNotes(instructions);
}
