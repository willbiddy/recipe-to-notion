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
	console.log("[isValidHttpUrl] Validating URL:", { url, type: typeof url });

	if (!url || typeof url !== "string") {
		console.log("[isValidHttpUrl] Invalid: not a string or falsy", { url, type: typeof url });
		return false;
	}

	const trimmed = url.trim();
	if (trimmed === "") {
		console.log("[isValidHttpUrl] Invalid: empty after trim");
		return false;
	}

	try {
		const { protocol } = new URL(trimmed);
		const isValid = protocol === "http:" || protocol === "https:";
		console.log("[isValidHttpUrl] Result:", { url: trimmed, protocol, isValid });
		return isValid;
	} catch (error) {
		console.log("[isValidHttpUrl] Invalid: URL parse error", { url: trimmed, error });
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
