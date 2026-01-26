import * as cheerio from "cheerio";
import { MAX_AUTHOR_SUFFIX_LENGTH } from "../../shared/constants.js";

/**
 * Pattern to match ISO 8601 duration strings (e.g., "PT1H30M", "PT45M").
 *
 * Matches hours (H), minutes (M), and seconds (S) components of ISO 8601 duration format.
 */
const ISO_DURATION_PATTERN = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i;

/**
 * Pattern to match "Recipe" suffix at the end of recipe names.
 *
 * Used to remove redundant "Recipe" suffixes from recipe titles.
 */
const RECIPE_SUFFIX_PATTERN = /\s+Recipe$/i;

/**
 * Pattern to match author name suffix pattern (e.g., " - Author Name").
 *
 * Captures the author name portion after " - " for removal from recipe titles.
 */
const AUTHOR_SUFFIX_PATTERN = /\s+-\s+(.+)$/m;

/**
 * Pattern to match double parentheses in ingredient strings.
 *
 * Used to normalize double parentheses like "((julienned))" to single parentheses.
 */
const DOUBLE_PARENTHESES_PATTERN = /\(\s*\(([^)]+)\)\s*\)/g;

/**
 * Pattern to match editor's note markers at the start of instruction steps.
 *
 * Used to identify and filter out instruction steps that are entirely editor's notes.
 */
const EDITOR_NOTE_START_PATTERN = /^Editor'?s?\s+note:?/i;

/**
 * Pattern to match editor's note markers at the end of instruction steps.
 *
 * Used to remove editor's note text that appears within instruction steps.
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

/**
 * Parses an ISO 8601 duration string (e.g. "PT1H30M") into total minutes.
 *
 * Converts duration strings like "PT1H30M" (1 hour 30 minutes) or
 * "PT45M" (45 minutes) into a total number of minutes.
 *
 * @param iso - ISO 8601 duration string to parse.
 * @returns Total minutes as a number (including 0 for valid zero durations), or null if parsing fails.
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
	const totalMinutes = hours * 60 + minutes;
	return totalMinutes;
}

/**
 * Cleans recipe names by removing common suffixes and author patterns.
 *
 * Removes "Recipe" suffix if present. Removes " - Author Name" pattern, but only if
 * the suffix looks like an author name: must be preceded by space-dash-space, must not
 * contain commas (recipe names often have commas, author names don't), and should be
 * relatively short (author names are typically < 50 chars). This prevents removing parts
 * of recipe names like "One-Pot Salmon, Spinach...".
 *
 * @param name - The raw recipe name to clean.
 * @returns Cleaned recipe name without suffixes.
 */
export function cleanRecipeName(name: string): string {
	let cleaned = name.replace(RECIPE_SUFFIX_PATTERN, "");

	cleaned = cleaned.replace(AUTHOR_SUFFIX_PATTERN, (match, suffix) => {
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

const FRACTION_MAP = new Map([
	["½", "1/2"],
	["¼", "1/4"],
	["¾", "3/4"],
	["⅓", "1/3"],
	["⅔", "2/3"],
	["⅛", "1/8"],
	["⅜", "3/8"],
	["⅝", "5/8"],
	["⅞", "7/8"],
	["⅕", "1/5"],
	["⅖", "2/5"],
	["⅗", "3/5"],
	["⅘", "4/5"],
	["⅙", "1/6"],
	["⅚", "5/6"],
]);

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
	let result = text;
	for (const [unicode, ascii] of FRACTION_MAP) {
		result = result.replaceAll(unicode, ascii);
	}
	return result;
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
