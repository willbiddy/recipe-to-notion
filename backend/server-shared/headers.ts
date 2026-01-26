/**
 * Sets security headers on responses.
 *
 * @param response - The response object to add security headers to.
 */
export function setSecurityHeaders(response: Response): void {
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}

/**
 * Gets the allowed CORS origin from environment configuration.
 *
 * If CORS_ORIGIN is set, uses that value (supports comma-separated list for multiple origins).
 * Otherwise, defaults to "*" for backward compatibility with browser extensions.
 *
 * @param requestOrigin - The origin from the request (optional, for origin matching).
 * @returns The allowed origin value to set in the CORS header.
 */
function getAllowedOrigin(requestOrigin?: string | null): string {
	const corsOrigin = process.env.CORS_ORIGIN;

	if (!corsOrigin) {
		// Default to wildcard for extension compatibility
		return "*";
	}

	// If multiple origins are specified, check if request origin matches
	if (corsOrigin.includes(",")) {
		const allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim());
		if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
			return requestOrigin;
		}
		// If no match and multiple origins specified, return first (or could return "*" for preflight)
		return allowedOrigins[0] || "*";
	}

	// Single origin specified
	return corsOrigin.trim();
}

/**
 * Handles CORS headers for browser extension and web requests.
 *
 * In production, set CORS_ORIGIN environment variable to restrict allowed origins.
 * If not set, defaults to "*" for backward compatibility with browser extensions.
 *
 * @param response - The response object to add CORS headers to.
 * @param request - Optional request object to extract origin from (for origin matching).
 */
export function setCorsHeaders(response: Response, request?: Request): void {
	const requestOrigin = request?.headers.get("Origin");
	const allowedOrigin = getAllowedOrigin(requestOrigin);

	response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.headers.set("Access-Control-Expose-Headers", "*");
	response.headers.set("Access-Control-Allow-Credentials", "false");
}
