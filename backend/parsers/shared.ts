import { MAX_AUTHOR_SUFFIX_LENGTH } from "@shared/constants.js";

const RECIPE_SUFFIX_PATTERN = /\s+Recipe$/i;
const AUTHOR_SUFFIX_PATTERN = /\s+-\s+(.+)$/m;
const DOUBLE_PARENTHESES_PATTERN = /\(\s*\(([^)]+)\)\s*\)/g;
const EDITOR_NOTE_START_PATTERN = /^Editor'?s?\s+note:?/i;
const EDITOR_NOTE_END_PATTERN = /\s*Editor'?s?\s+note:?.*$/i;

/**
 * Cleans recipe names by removing common suffixes and author patterns.
 *
 * @param name - Raw recipe name to clean
 * @returns Cleaned recipe name
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
 * @param text - Text potentially containing Unicode fractions
 * @returns Text with fractions normalized to ASCII
 */
export function normalizeFractions(text: string): string {
	let result = text;
	for (const [unicode, ascii] of FRACTION_MAP) {
		result = result.replaceAll(unicode, ascii);
	}
	return result;
}

const TRAILING_ASTERISKS_PATTERN = /\*+\s*$/;

/**
 * Normalizes and cleans ingredient text.
 *
 * @param ingredient - Raw ingredient string
 * @returns Cleaned ingredient text
 */
export function normalizeIngredient(ingredient: string): string {
	return ingredient
		.replace(DOUBLE_PARENTHESES_PATTERN, (_, content) => {
			return `(${content.trim()})`;
		})
		.replace(TRAILING_ASTERISKS_PATTERN, "")
		.trim();
}

/**
 * Filters out editor's notes from instruction arrays.
 *
 * @param instructions - Array of instruction step strings
 * @returns Filtered array with editor's notes removed
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
