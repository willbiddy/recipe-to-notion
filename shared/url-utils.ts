/**
 * URL validation and manipulation utilities.
 */

/**
 * Validates if a URL is a valid HTTP or HTTPS URL.
 *
 * @param url - The URL string to validate.
 * @returns True if the URL is a valid HTTP or HTTPS URL, false otherwise.
 */
export function isValidHttpUrl(url: string): boolean {
	if (!url || typeof url !== "string") {
		return false;
	}

	const trimmed = url.trim();
	if (trimmed === "") {
		return false;
	}

	try {
		const { protocol } = new URL(trimmed);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
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

/**
 * Strips query parameters and hash fragments from a URL.
 *
 * @param url - The URL string to strip query parameters from.
 * @returns The URL without query parameters and hash, or the original URL if parsing fails.
 */
export function stripQueryParams(url: string): string {
	try {
		const urlObj = new URL(url);
		return `${urlObj.origin}${urlObj.pathname}`;
	} catch {
		return url;
	}
}
