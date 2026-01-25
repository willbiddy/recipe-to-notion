import * as cheerio from "cheerio";

// ─────────────────────────────────────────────────────────────────────────────
// Regular Expression Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ISO 8601 duration pattern (e.g., "PT1H30M", "PT45M").
 * Captures hours, minutes, and seconds groups.
 */
const ISO_DURATION_PATTERN = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i;

/**
 * Pattern to match "Recipe" suffix at the end of recipe names.
 */
const RECIPE_SUFFIX_PATTERN = /\s+Recipe$/i;

/**
 * Pattern to match author name suffix (e.g., " - Author Name").
 * Captures the suffix text after " - ".
 */
const AUTHOR_SUFFIX_PATTERN = /\s+-\s+(.+)$/m;

/**
 * Pattern to match double parentheses with optional spaces.
 * Captures the inner content of double parentheses like "((text))" or "( (text) )".
 */
const DOUBLE_PARENTHESES_PATTERN = /\(\s*\(([^)]+)\)\s*\)/g;

/**
 * Pattern to match editor's note at the start of a line.
 */
const EDITOR_NOTE_START_PATTERN = /^Editor'?s?\s+note:?/i;

/**
 * Pattern to match editor's note at the end of text.
 */
const EDITOR_NOTE_END_PATTERN = /\s*Editor'?s?\s+note:?.*$/i;

/**
 * Pattern to match ingredient list headers (should be filtered out).
 */
export const INGREDIENT_HEADER_PATTERN = /^(INGREDIENTS|INGREDIENT LIST)$/i;

/**
 * Pattern to match instruction section headers (should be filtered out).
 */
export const INSTRUCTION_HEADER_PATTERN = /^(INSTRUCTIONS|DIRECTIONS|STEPS)$/i;

/**
 * Pattern to match ingredient list headers (should be filtered out).
 */
export const INGREDIENT_HEADER_PATTERN = /^(INGREDIENTS|INGREDIENT LIST)$/i;

// ─────────────────────────────────────────────────────────────────────────────
// HTML entity decoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decodes HTML entities and normalizes Unicode fractions to ASCII.
 *
 * Uses cheerio's built-in HTML parser to decode all entity types:
 * named entities (e.g., &frac34;), decimal (&#8532;), and hex (&#x2154;).
 * Also converts Unicode fraction characters to ASCII equivalents.
 *
 * @param str - String potentially containing HTML entities and Unicode fractions.
 * @returns String with HTML entities decoded and fractions normalized.
 */
export function decodeHtmlEntities(str: string): string {
	const decoded = cheerio.load(str, null, false).text();
	return normalizeFractions(decoded);
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
	if (!iso || typeof iso !== "string") {
		return null;
	}

	const match = iso.match(ISO_DURATION_PATTERN);
	if (!match) {
		return null;
	}

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
/**
 * Maximum length for author name suffixes (characters).
 * Used to distinguish author names from recipe name parts.
 */
const MAX_AUTHOR_SUFFIX_LENGTH = 50;

export function cleanRecipeName(name: string): string {
	// Remove "Recipe" suffix if present
	let cleaned = name.replace(RECIPE_SUFFIX_PATTERN, "");

	// Remove " - Author Name" pattern, but only if the suffix looks like an author name:
	// - Must be preceded by space-dash-space (not just a dash in the recipe name)
	// - Suffix must not contain commas (recipe names often have commas, author names don't)
	// - Suffix should be relatively short (author names are typically < 50 chars)
	cleaned = cleaned.replace(AUTHOR_SUFFIX_PATTERN, (match, suffix) => {
		// Only remove if the suffix doesn't contain commas and is short
		// This prevents removing parts of recipe names like "One-Pot Salmon, Spinach..."
		if (
			!suffix.includes(",") &&
			suffix.trim().length > 0 &&
			suffix.length < MAX_AUTHOR_SUFFIX_LENGTH
		) {
			return "";
		}
		return match;
	});

	return cleaned.trim();
}

/**
 * Normalizes Unicode fraction characters to ASCII equivalents.
 *
 * Converts Unicode fraction characters (e.g., ½, ¼, ¾) to their
 * ASCII equivalents (e.g., 1/2, 1/4, 3/4) for consistent display.
 *
 * @param text - The text potentially containing Unicode fractions.
 * @returns The text with fractions normalized to ASCII.
 */
export function normalizeFractions(text: string): string {
	return text
		.replace(/½/g, "1/2")
		.replace(/¼/g, "1/4")
		.replace(/¾/g, "3/4")
		.replace(/⅓/g, "1/3")
		.replace(/⅔/g, "2/3")
		.replace(/⅛/g, "1/8")
		.replace(/⅜/g, "3/8")
		.replace(/⅝/g, "5/8")
		.replace(/⅞/g, "7/8")
		.replace(/⅕/g, "1/5")
		.replace(/⅖/g, "2/5")
		.replace(/⅗/g, "3/5")
		.replace(/⅘/g, "4/5")
		.replace(/⅙/g, "1/6")
		.replace(/⅚/g, "5/6");
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
		.replace(DOUBLE_PARENTHESES_PATTERN, (_, content) => {
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
			const isEntirelyNote = EDITOR_NOTE_START_PATTERN.test(trimmed);
			if (isEntirelyNote) {
				return "";
			}
			const cleaned = trimmed.replace(EDITOR_NOTE_END_PATTERN, "").trim();
			return cleaned;
		})
		.filter((instruction) => instruction.length > 0);
}
