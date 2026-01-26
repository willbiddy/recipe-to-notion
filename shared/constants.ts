/**
 * Centralized constants and enums used throughout the application.
 */

// ============================================================================
// URL Protocols
// ============================================================================

/**
 * URL protocols for HTTP/HTTPS validation.
 */
export enum UrlProtocol {
	HTTP = "http://",
	HTTPS = "https://",
}

/**
 * Schema.org Recipe URLs for microdata parsing.
 */
export enum SchemaOrgRecipeUrl {
	HTTP = "http://schema.org/Recipe",
	HTTPS = "https://schema.org/Recipe",
}

// ============================================================================
// UI Delays (milliseconds)
// ============================================================================

/**
 * Delay before opening Notion page after successful save (milliseconds).
 */
export const NOTION_OPEN_DELAY_MS = 500;

/**
 * Delay before auto-submitting URL from query parameters (milliseconds).
 */
export const AUTO_SUBMIT_DELAY_MS = 300;

/**
 * Delay before clearing URL input after successful save (milliseconds).
 */
export const CLEAR_URL_INPUT_DELAY_MS = 500;

/**
 * Delay before clearing success status message (milliseconds).
 */
export const SUCCESS_STATUS_CLEAR_DELAY_MS = 2000;

// ============================================================================
// Network & Server Configuration
// ============================================================================

/**
 * Request timeout in milliseconds (30 seconds).
 * Prevents DoS attacks via slow responses or resource exhaustion.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Maximum request body size in bytes (10 KB).
 */
export const MAX_REQUEST_BODY_SIZE = 10 * 1024;

/**
 * Maximum URL length in characters.
 */
export const MAX_URL_LENGTH = 2048;

/**
 * Default server port.
 */
export const DEFAULT_PORT = 3000;

/**
 * Minimum valid port number.
 */
export const MIN_PORT = 1;

/**
 * Maximum valid port number.
 */
export const MAX_PORT = 65535;

/**
 * Server idle timeout in seconds.
 */
export const IDLE_TIMEOUT_SECONDS = 60;

/**
 * Rate limit cleanup interval in milliseconds (5 minutes).
 * Removes expired entries to prevent memory leaks.
 */
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// ============================================================================
// Notion Limits
// ============================================================================

/**
 * Maximum text length for Notion text blocks (characters).
 */
export const MAX_TEXT_LENGTH = 2000;

/**
 * Maximum number of blocks allowed in a Notion page.
 */
export const MAX_NOTION_BLOCKS = 100;

/**
 * Length of ellipsis string ("...") used when truncating text.
 */
export const ELLIPSIS_LENGTH = 3;

// ============================================================================
// Parsing Limits
// ============================================================================

/**
 * Maximum length for author name suffixes (characters).
 * Used to distinguish author names from recipe name parts.
 */
export const MAX_AUTHOR_SUFFIX_LENGTH = 50;

/**
 * Maximum length for site name to be considered as author (characters).
 */
export const MAX_SITE_NAME_LENGTH = 50;

// ============================================================================
// API Error Patterns
// ============================================================================

/**
 * API error message patterns for detecting authentication errors.
 */
export enum ApiErrorPattern {
	InvalidApiKey = "invalid api key",
	MissingAuthorization = "missing authorization",
	InvalidAuthorization = "invalid authorization",
}

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Error message keys for consistent error messaging.
 */
export enum ErrorMessageKey {
	InvalidApiKey = "InvalidApiKey",
	NotValidWebPageUrl = "NotValidWebPageUrl",
	NoUrlFound = "NoUrlFound",
	DuplicateRecipeFound = "DuplicateRecipeFound",
	PleaseEnterRecipeUrl = "PleaseEnterRecipeUrl",
	FailedToSaveRecipe = "FailedToSaveRecipe",
	UnexpectedError = "UnexpectedError",
}

/**
 * Gets the user-facing error message for a given error key.
 *
 * @param key - The error message key.
 * @returns The user-facing error message string.
 */
export function getErrorMessage(key: ErrorMessageKey): string {
	const messages: Record<ErrorMessageKey, string> = {
		[ErrorMessageKey.InvalidApiKey]: "Invalid API key. Please update your API secret.",
		[ErrorMessageKey.NotValidWebPageUrl]: "Not a valid web page URL.",
		[ErrorMessageKey.NoUrlFound]: "No URL found. Please navigate to a recipe page.",
		[ErrorMessageKey.DuplicateRecipeFound]: "This recipe already exists.",
		[ErrorMessageKey.PleaseEnterRecipeUrl]: "Please enter a recipe URL",
		[ErrorMessageKey.FailedToSaveRecipe]: "Failed to save recipe",
		[ErrorMessageKey.UnexpectedError]: "An unexpected error occurred",
	};
	return messages[key];
}
