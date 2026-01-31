/**
 * HTTP utilities including status codes, headers, and CORS handling.
 */

/**
 * HTTP status codes.
 */
export enum HttpStatus {
	OK = 200,
	NoContent = 204,
	BadRequest = 400,
	NotFound = 404,
	MethodNotAllowed = 405,
	Conflict = 409,
	InternalServerError = 500,
	BadGateway = 502,
}

/**
 * Rate limit header names.
 */
export enum RateLimitHeader {
	Limit = "X-RateLimit-Limit",
	Remaining = "X-RateLimit-Remaining",
	Reset = "X-RateLimit-Reset",
}

/**
 * Default rate limit (requests per minute).
 */
export const DEFAULT_RATE_LIMIT_VALUE = 10;

/**
 * Security header names.
 */
export enum SecurityHeader {
	ContentTypeOptions = "X-Content-Type-Options",
	FrameOptions = "X-Frame-Options",
	ReferrerPolicy = "Referrer-Policy",
}

/**
 * Security header values.
 */
export enum SecurityHeaderValue {
	NoSniff = "nosniff",
	Deny = "DENY",
	StrictOrigin = "strict-origin-when-cross-origin",
}

/**
 * Sets security headers on responses.
 *
 * @param response - Response to add headers to.
 */
export function setSecurityHeaders(response: Response): void {
	response.headers.set(SecurityHeader.ContentTypeOptions, SecurityHeaderValue.NoSniff);
	response.headers.set(SecurityHeader.FrameOptions, SecurityHeaderValue.Deny);
	response.headers.set(SecurityHeader.ReferrerPolicy, SecurityHeaderValue.StrictOrigin);
}

/**
 * Gets the allowed CORS origin.
 *
 * @param requestOrigin - Origin from request headers.
 * @returns Allowed origin value.
 */
function getAllowedOrigin(requestOrigin?: string | null): string {
	const corsOrigin = process.env.CORS_ORIGIN;

	if (!corsOrigin) {
		return "*";
	}

	if (corsOrigin.includes(",")) {
		const allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim());
		if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
			return requestOrigin;
		}
		return allowedOrigins[0] || "*";
	}

	return corsOrigin.trim();
}

/**
 * Sets CORS headers on responses.
 *
 * @param response - Response to add headers to.
 * @param request - Optional request for origin extraction.
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

/**
 * Handles OPTIONS preflight requests.
 *
 * @param request - Incoming request.
 * @returns 204 No Content response with CORS headers.
 */
export function handleOptionsRequest(request: Request): Response {
	const response = new Response(null, { status: HttpStatus.NoContent });
	setSecurityHeaders(response);
	setCorsHeaders(response, request);
	return response;
}
