import { ELLIPSIS_LENGTH } from "@shared/constants.js";
import { hasProperty, isObject } from "@shared/type-guards.js";
import { NotionApiError } from "../errors.js";
import type { NotionApiErrorResponse } from "./types.js";

/**
 * Pattern to match escaped double newlines in description text.
 *
 * Used to normalize escaped newline sequences (\\n\\n) to actual paragraph breaks.
 */
const ESCAPED_DOUBLE_NEWLINE_PATTERN = /\\n\\n/g;

/**
 * Pattern to match escaped single newlines in description text.
 *
 * Used to normalize escaped newline sequences (\\n) to actual newlines.
 */
const ESCAPED_SINGLE_NEWLINE_PATTERN = /\\n/g;

/**
 * Type guard to check if an error is a Notion API error response.
 *
 * @param error - The error to check.
 * @returns True if the error has the structure of a Notion API error.
 */
export function isNotionApiErrorResponse(error: unknown): error is NotionApiErrorResponse {
	return isObject(error) && hasProperty(error, "code");
}

/**
 * Handles Notion API errors and converts them to NotionApiError.
 *
 * Extracts error details from Notion API error responses and creates
 * appropriate NotionApiError instances with property information.
 *
 * @param error - The error from the Notion API.
 * @param propertyName - The Notion property name that was being accessed.
 * @param propertyType - The expected type of the property.
 * @throws NotionApiError with detailed error information.
 */
export function handleNotionApiError(
	error: unknown,
	propertyName: string,
	propertyType: string,
): never {
	if (isNotionApiErrorResponse(error)) {
		throw new NotionApiError({
			message: `Notion API error: ${error.status || "Unknown"} ${error.message || "Unknown error"}. ${error.code ? `(code: ${error.code})` : ""}. Check that the property "${propertyName}" exists in your database and is a ${propertyType} type.`,
			statusCode: error.status || 500,
			propertyName,
			propertyType,
		});
	}
	throw error;
}

/**
 * Normalizes description text by handling escaped newlines.
 *
 * Converts both literal \n\n strings (escaped) and actual newlines to proper paragraph breaks.
 * Processes escaped newlines first, then actual newlines.
 *
 * @param text - The description text to normalize.
 * @returns Normalized text with proper newline handling.
 */
export function normalizeDescriptionText(text: string): string {
	return text
		.replace(ESCAPED_DOUBLE_NEWLINE_PATTERN, "\n\n")
		.replace(ESCAPED_SINGLE_NEWLINE_PATTERN, "\n");
}

/**
 * Truncates text to a maximum length, appending "..." if truncated.
 *
 * @param text - The text to truncate.
 * @param maxLength - The maximum allowed length.
 * @returns The truncated text with "..." appended if needed.
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - ELLIPSIS_LENGTH)}...`;
}
