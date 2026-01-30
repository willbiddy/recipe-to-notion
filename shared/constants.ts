/**
 * Centralized constants and enums used throughout the application.
 */

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

/**
 * Request timeout in milliseconds (30 seconds).
 * Prevents DoS attacks via slow responses or resource exhaustion.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Maximum request body size in bytes (10 KB).
 *
 * Chosen value (10 KB): Recipe API requests only contain a URL string, so 10 KB is
 * more than sufficient. Prevents DoS attacks via large request bodies while allowing
 * legitimate requests with extra metadata if needed in the future.
 */
export const MAX_REQUEST_BODY_SIZE = 10 * 1024;

/**
 * Maximum URL length in characters.
 *
 * Chosen value (2048): Standard maximum URL length supported by most browsers and servers.
 * Prevents DoS attacks via extremely long URLs while allowing legitimate long URLs.
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

/**
 * Maximum text length for Notion text blocks (characters).
 */
export const MAX_TEXT_LENGTH = 2000;

/**
 * Length of ellipsis string ("...") used when truncating text.
 */
export const ELLIPSIS_LENGTH = 3;

/**
 * Maximum length for author name suffixes (characters).
 * Used to distinguish author names from recipe name parts.
 *
 * Chosen value (50): Most author names are under 50 characters. Recipe names often
 * contain commas and can be longer. This threshold helps distinguish " - Author Name"
 * patterns from recipe names like "One-Pot Salmon, Spinach, and Tomatoes".
 */
export const MAX_AUTHOR_SUFFIX_LENGTH = 50;

/**
 * Maximum length for site name to be considered as author (characters).
 *
 * Chosen value (50): Site names used as fallback authors should be reasonable length.
 * Prevents very long domain names or site titles from being used as author attribution.
 */
export const MAX_SITE_NAME_LENGTH = 50;

/**
 * API error message patterns for detecting authentication errors.
 */
export enum ApiErrorPattern {
	InvalidApiSecret = "invalid api secret",
	MissingAuthorization = "missing authorization",
	InvalidAuthorization = "invalid authorization",
}

/**
 * Theme options for the browser extension.
 */
export enum Theme {
	Light = "light",
	Dark = "dark",
}

/**
 * Message types for extension communication.
 */
export enum ExtensionMessageType {
	ThemeChanged = "theme-changed",
	ExtractRecipeData = "extract-recipe-data",
	GetPageUrl = "get-page-url",
}

/**
 * Progress event types during recipe processing.
 */
export enum ProgressType {
	CheckingDuplicates = "checking_duplicates",
	Scraping = "scraping",
	Tagging = "tagging",
	Saving = "saving",
}

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
		[ErrorMessageKey.InvalidApiKey]: "Invalid API secret. Please update your API secret.",
		[ErrorMessageKey.NotValidWebPageUrl]: "Not a valid web page URL.",
		[ErrorMessageKey.NoUrlFound]: "No URL found. Please navigate to a recipe page.",
		[ErrorMessageKey.DuplicateRecipeFound]: "This recipe already exists.",
		[ErrorMessageKey.PleaseEnterRecipeUrl]: "Please enter a recipe URL",
		[ErrorMessageKey.FailedToSaveRecipe]: "Failed to save recipe",
		[ErrorMessageKey.UnexpectedError]: "An unexpected error occurred",
	};
	return messages[key];
}
