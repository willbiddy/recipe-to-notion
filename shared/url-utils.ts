/**
 * URL validation and manipulation utilities.
 */

/**
 * Validates if a URL is a valid HTTP or HTTPS URL.
 *
 * @param url - URL string to validate
 * @returns True if valid HTTP/HTTPS URL
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
 * Extracts the clean hostname from a URL.
 *
 * @param url - URL to extract hostname from
 * @returns Hostname without "www." prefix, or null if invalid
 */
export function getWebsiteName(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}

/**
 * Resolves author with fallback chain: author → siteName → website name → URL.
 *
 * @param author - Primary author name (can be null/undefined)
 * @param siteName - Site name fallback
 * @param sourceUrl - Source URL for final fallback
 * @returns Resolved author string
 */
export function resolveAuthor(
	author: string | null | undefined,
	siteName: string | null | undefined,
	sourceUrl: string,
): string {
	return author || siteName || getWebsiteName(sourceUrl) || sourceUrl;
}

/**
 * Strips query parameters and hash fragments from a URL.
 *
 * @param url - URL to normalize
 * @returns URL without query params and hash
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
 * @param url - URL that failed validation
 * @param permissionIssue - Whether the issue is due to missing permissions
 * @returns Error message explaining why URL is unsupported
 */
export function getUnsupportedUrlMessage(url: string | null, permissionIssue?: boolean): string {
	if (permissionIssue) {
		return "Permission denied. Please remove and re-add the extension from chrome://extensions/ to grant required permissions.";
	}

	if (!url) {
		return "No webpage detected. Try refreshing the page and reopening the extension.";
	}

	const PROTOCOL_MESSAGES: Record<string, string> = {
		"chrome:": "Cannot save from browser pages",
		"chrome-extension:": "Cannot save from extension pages",
		"about:": "Cannot save from this page",
		"file:": "Cannot save from local files",
	};

	try {
		const { protocol } = new URL(url);
		return PROTOCOL_MESSAGES[protocol] || "Not a valid web page";
	} catch {
		return "Not a valid web page";
	}
}
