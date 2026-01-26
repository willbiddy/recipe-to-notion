/**
 * Centralized constants and enums used throughout the application.
 */

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

/**
 * API error message patterns for detecting authentication errors.
 */
export enum ApiErrorPattern {
	InvalidApiKey = "invalid api key",
	MissingAuthorization = "missing authorization",
	InvalidAuthorization = "invalid authorization",
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
