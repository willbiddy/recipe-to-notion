/**
 * Error handling and detection utilities.
 *
 * Provides functions for identifying specific error types (e.g., API key errors)
 * to enable appropriate error handling and user messaging.
 */

import { ApiErrorPattern } from "@shared/constants";

/**
 * Checks if an error message indicates an API key authentication error.
 *
 * Used to determine if the user should be prompted to update their API key.
 * Matches against known API error patterns like "invalid api secret",
 * "missing authorization", and "invalid authorization".
 *
 * @param errorMessage - The error message to check.
 * @returns True if the error message matches known API key error patterns, false otherwise.
 *
 * @example
 * ```ts
 * isApiKeyError("Invalid API secret provided")
 * // Returns: true
 *
 * isApiKeyError("Missing authorization header")
 * // Returns: true
 *
 * isApiKeyError("Recipe not found")
 * // Returns: false
 *
 * // Used in error handling:
 * if (isApiKeyError(errorMessage)) {
 *   setIsInvalidApiKey(true);
 *   setStatus({ message: "Invalid API key", type: StatusType.Error });
 * }
 * ```
 */
export function isApiKeyError(errorMessage: string): boolean {
	const lowerMessage = errorMessage.toLowerCase();
	return (
		lowerMessage.includes(ApiErrorPattern.InvalidApiSecret) ||
		lowerMessage.includes(ApiErrorPattern.MissingAuthorization) ||
		lowerMessage.includes(ApiErrorPattern.InvalidAuthorization)
	);
}
