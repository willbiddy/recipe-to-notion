/**
 * URL validation and manipulation utilities.
 */

import { UrlProtocol } from "./constants.js";

/**
 * Validates if a URL is a valid HTTP or HTTPS URL.
 *
 * @param url - The URL string to validate.
 * @returns True if the URL starts with http:// or https://, false otherwise.
 */
export function isValidHttpUrl(url: string): boolean {
	return url.startsWith(UrlProtocol.HTTP) || url.startsWith(UrlProtocol.HTTPS);
}

/**
 * Extracts the clean hostname from a URL (removes "www." prefix).
 *
 * @param url - The URL to extract the hostname from.
 * @returns The clean hostname or null if extraction fails.
 */
export function getWebsiteName(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}
