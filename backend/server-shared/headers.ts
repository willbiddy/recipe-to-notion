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
 * Handles CORS headers for browser extension requests.
 *
 * @param response - The response object to add CORS headers to.
 */
export function setCorsHeaders(response: Response): void {
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	response.headers.set("Access-Control-Expose-Headers", "*");
	response.headers.set("Access-Control-Allow-Credentials", "false");
}
