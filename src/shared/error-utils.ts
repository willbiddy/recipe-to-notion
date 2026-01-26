/**
 * Error handling and detection utilities.
 */

import { ApiErrorPattern } from "./constants.js";

/**
 * Checks if an error message indicates an API key authentication error.
 *
 * @param errorMessage - The error message to check.
 * @returns True if the error message matches known API key error patterns, false otherwise.
 */
export function isApiKeyError(errorMessage: string): boolean {
	const lowerMessage = errorMessage.toLowerCase();
	return (
		lowerMessage.includes(ApiErrorPattern.InvalidApiKey) ||
		lowerMessage.includes(ApiErrorPattern.MissingAuthorization) ||
		lowerMessage.includes(ApiErrorPattern.InvalidAuthorization)
	);
}
