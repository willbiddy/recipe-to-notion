/**
 * HTTP status codes used throughout the server.
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
 * Rate limit header names for responses.
 */
export const RATE_LIMIT_HEADERS = {
	LIMIT: "X-RateLimit-Limit",
	REMAINING: "X-RateLimit-Remaining",
	RESET: "X-RateLimit-Reset",
} as const;

/**
 * Default rate limit value (requests per minute).
 */
export const DEFAULT_RATE_LIMIT_VALUE = 10;
