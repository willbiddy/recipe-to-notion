import * as cheerio from "cheerio";

// ─────────────────────────────────────────────────────────────────────────────
// HTML entity decoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decodes HTML entities in a string to their Unicode characters.
 *
 * Uses cheerio's built-in HTML parser to decode all entity types:
 * named entities (e.g., &frac34;), decimal (&#8532;), and hex (&#x2154;).
 *
 * @param str - String potentially containing HTML entities.
 * @returns String with HTML entities decoded.
 */
export function decodeHtmlEntities(str: string): string {
	return cheerio.load(str, null, false).text();
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard that returns true if value is a non-null object.
 *
 * @param value - The value to check.
 * @returns True if value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Type guard that returns true if value is an object with the specified property.
 *
 * @param value - The value to check.
 * @param key - The property key to check for.
 * @returns True if value is an object containing the specified key.
 */
export function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
	return isObject(value) && key in value;
}

/**
 * Type guard that returns true if value is a string.
 *
 * @param value - The value to check.
 * @returns True if value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Type guard that returns true if value is an array.
 *
 * @param value - The value to check.
 * @returns True if value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an ISO 8601 duration string (e.g. "PT1H30M") into total minutes.
 *
 * Converts duration strings like "PT1H30M" (1 hour 30 minutes) or
 * "PT45M" (45 minutes) into a total number of minutes.
 *
 * @param iso - ISO 8601 duration string to parse.
 * @returns Total minutes as a number, or null if parsing fails.
 */
export function parseDuration(iso: string | undefined): number | null {
	if (!iso || typeof iso !== "string") return null;
	const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
	if (!match) return null;
	const hours = parseInt(match[1] || "0", 10);
	const minutes = parseInt(match[2] || "0", 10);
	return hours * 60 + minutes || null;
}

/**
 * Cleans up a recipe name by removing trailing "Recipe" suffix and author names.
 *
 * Many recipe sites append "Recipe" to the title (e.g., "Chicken Parmesan Recipe")
 * or include author names (e.g., "Well-fried Beans - Rick Bayless").
 * This removes those suffixes for cleaner display.
 *
 * @param name - The raw recipe name.
 * @returns The cleaned recipe name.
 */
export function cleanRecipeName(name: string): string {
	return name
		.replace(/\s+Recipe$/i, "")
		.replace(/\s*-\s*[^-]+$/, "") // Remove " - Author Name" pattern
		.trim();
}

/**
 * Normalizes parentheses in ingredient strings by removing double parentheses.
 *
 * Some recipe sources include double parentheses like "((julienned))" which should
 * be normalized to single parentheses "(julienned)" for cleaner display.
 * Also handles cases with spaces like ( (text) ) or (( text )).
 * Trims spaces inside the parentheses for cleaner output.
 *
 * @param ingredient - The raw ingredient string.
 * @returns The ingredient string with normalized parentheses.
 */
export function normalizeIngredientParentheses(ingredient: string): string {
	return ingredient
		.replace(/\(\s*\(([^)]+)\)\s*\)/g, (_, content) => {
			return `(${content.trim()})`;
		})
		.trim();
}

/**
 * Filters out editor's notes and similar editorial content from instruction arrays.
 *
 * Removes instruction steps that are entirely editor's notes, and strips
 * editor's notes that appear within instruction text (e.g., at the end of a step).
 * Handles patterns like "Editor's note:", "Editor note:", or similar editorial markers.
 *
 * @param instructions - Array of instruction step strings.
 * @returns Filtered array with editor's notes removed and cleaned.
 */
export function filterEditorNotes(instructions: string[]): string[] {
	return instructions
		.map((instruction) => {
			const trimmed = instruction.trim();
			/**
			 * Check if the instruction is entirely an editor's note.
			 */
			const isEntirelyNote = /^Editor'?s?\s+note:?/i.test(trimmed);
			if (isEntirelyNote) {
				/**
				 * Return empty string to filter it out later.
				 */
				return "";
			}
			/**
			 * Remove editor's note from within the instruction text.
			 * Matches "Editor's note:" or "Editor note:" and everything after it to the end.
			 */
			const cleaned = trimmed.replace(/\s*Editor'?s?\s+note:?.*$/i, "").trim();
			return cleaned;
		})
		.filter((instruction) => instruction.length > 0);
}
