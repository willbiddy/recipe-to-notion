/**
 * URL validation and manipulation utilities.
 *
 * Provides functions for:
 * - Validating HTTP/HTTPS URLs
 * - Extracting clean hostnames
 * - Stripping query parameters
 * - Generating user-friendly error messages for unsupported URLs
 *
 * These utilities are used throughout the application for URL handling
 * in both the extension and web interface.
 */

/**
 * Validates if a URL is a valid HTTP or HTTPS URL.
 *
 * Rejects file:// URLs, chrome:// URLs, and other non-HTTP(S) protocols.
 * Also validates URL format using the URL constructor.
 *
 * @param url - The URL string to validate.
 * @returns True if the URL is a valid HTTP or HTTPS URL, false otherwise.
 *
 * @example
 * ```ts
 * isValidHttpUrl("https://example.com") // true
 * isValidHttpUrl("http://example.com/recipe") // true
 * isValidHttpUrl("chrome://extensions") // false
 * isValidHttpUrl("file:///Users/...") // false
 * isValidHttpUrl("not a url") // false
 * isValidHttpUrl("") // false
 * ```
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
 * Used for displaying website names in the UI (e.g., "allrecipes.com"
 * instead of "www.allrecipes.com").
 *
 * @param url - The URL to extract the hostname from.
 * @returns The clean hostname or null if extraction fails.
 *
 * @example
 * ```ts
 * getWebsiteName("https://www.allrecipes.com/recipe/12345")
 * // Returns: "allrecipes.com"
 *
 * getWebsiteName("https://cooking.nytimes.com/recipes/123")
 * // Returns: "cooking.nytimes.com"
 *
 * getWebsiteName("invalid-url")
 * // Returns: null
 * ```
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
 * Useful for normalizing URLs before comparisons (e.g., duplicate detection).
 * Preserves only the origin and pathname.
 *
 * @param url - The URL string to strip query parameters from.
 * @returns The URL without query parameters and hash, or the original URL if parsing fails.
 *
 * @example
 * ```ts
 * stripQueryParams("https://example.com/recipe?utm_source=fb#reviews")
 * // Returns: "https://example.com/recipe"
 *
 * stripQueryParams("https://example.com/recipe")
 * // Returns: "https://example.com/recipe"
 *
 * stripQueryParams("invalid")
 * // Returns: "invalid" (fallback to original)
 * ```
 */
export function stripQueryParams(url: string): string {
	try {
		const urlObj = new URL(url);
		return `${urlObj.origin}${urlObj.pathname}`;
	} catch {
		return url;
	}
}

/**
 * Gets a user-friendly error message for unsupported URLs.
 *
 * Provides context-specific messages for different URL protocols and error conditions.
 * Used in the extension popup to help users understand why a page can't be saved.
 *
 * @param url - The URL to check.
 * @param permissionIssue - Whether the issue is due to missing permissions.
 * @returns A user-friendly error message explaining why the URL is unsupported.
 *
 * @example
 * ```ts
 * getUnsupportedUrlMessage("chrome://extensions", false)
 * // Returns: "Cannot save from browser pages"
 *
 * getUnsupportedUrlMessage("file:///Users/...", false)
 * // Returns: "Cannot save from local files"
 *
 * getUnsupportedUrlMessage(null, true)
 * // Returns: "Permission denied. Please remove and re-add the extension..."
 *
 * getUnsupportedUrlMessage(null, false)
 * // Returns: "No webpage detected. Try refreshing the page..."
 * ```
 */
export function getUnsupportedUrlMessage(url: string | null, permissionIssue?: boolean): string {
	if (permissionIssue) {
		return "Permission denied. Please remove and re-add the extension from chrome://extensions/ to grant required permissions.";
	}

	if (!url) {
		return "No webpage detected. Try refreshing the page and reopening the extension.";
	}

	try {
		const { protocol } = new URL(url);
		if (protocol === "chrome:") {
			return "Cannot save from browser pages";
		}
		if (protocol === "chrome-extension:") {
			return "Cannot save from extension pages";
		}
		if (protocol === "about:") {
			return "Cannot save from this page";
		}
		if (protocol === "file:") {
			return "Cannot save from local files";
		}
		return "Not a valid web page";
	} catch {
		return "Not a valid web page";
	}
}
