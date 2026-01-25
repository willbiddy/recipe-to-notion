import { timingSafeEqual } from "node:crypto";

/**
 * HTTP status codes used for security-related responses.
 */
export const SecurityHttpStatus = {
	BadRequest: 400,
	InternalServerError: 500,
} as const;

/**
 * Maximum request body size in bytes (10KB).
 * Prevents DoS attacks via large request bodies.
 */
export const MAX_REQUEST_BODY_SIZE = 10 * 1024;

/**
 * Request body format for recipe endpoints.
 */
export type RecipeRequest = {
	/**
	 * Recipe URL to process.
	 */
	url: string;
	/**
	 * If true, use SSE for progress updates.
	 */
	stream?: boolean;
};

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses Bun's native crypto.timingSafeEqual for secure comparison.
 *
 * @param a - First string to compare.
 * @param b - Second string to compare.
 * @returns True if strings are equal, false otherwise.
 */
export function constantTimeEquals(a: string, b: string): boolean {
	// Convert strings to buffers for timing-safe comparison
	const aBuffer = Buffer.from(a, "utf8");
	const bBuffer = Buffer.from(b, "utf8");

	// timingSafeEqual requires buffers of the same length
	// If lengths differ, they're not equal (but we still need to compare in constant time)
	if (aBuffer.length !== bBuffer.length) {
		return false;
	}

	try {
		return timingSafeEqual(aBuffer, bBuffer);
	} catch {
		// Should not happen if lengths are equal, but handle gracefully
		return false;
	}
}

/**
 * Validates the API key from the Authorization header.
 * Returns null if valid, or an error response if invalid.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param authHeader - The Authorization header value.
 * @param createErrorResponse - Function to create error responses (allows different response formats).
 * @returns Null if valid, or an error response if invalid.
 */
export function validateApiKeyHeader(
	authHeader: string | null,
	createErrorResponse: (error: string, status: number) => Response,
): Response | null {
	if (!authHeader) {
		return createErrorResponse("Missing Authorization header", SecurityHttpStatus.BadRequest);
	}

	if (!authHeader.startsWith("Bearer ")) {
		return createErrorResponse(
			"Invalid Authorization format. Expected: Bearer <token>",
			SecurityHttpStatus.BadRequest,
		);
	}

	const providedKey = authHeader.slice(7).trim(); // Remove "Bearer " prefix and trim whitespace
	const expectedKey = process.env.API_SECRET?.trim();

	if (!expectedKey) {
		console.error("API_SECRET environment variable is not set");
		return createErrorResponse(
			"Server configuration error",
			SecurityHttpStatus.InternalServerError,
		);
	}

	// Use constant-time comparison to prevent timing attacks
	if (!constantTimeEquals(providedKey, expectedKey)) {
		return createErrorResponse("Invalid API key", SecurityHttpStatus.BadRequest);
	}

	return null;
}

/**
 * Validates a recipe URL to ensure it's safe to process.
 * Only allows HTTP and HTTPS protocols to prevent SSRF attacks.
 *
 * @param urlString - The URL string to validate.
 * @param createErrorResponse - Function to create error responses.
 * @returns Null if valid, or an error response if invalid.
 */
export function validateRecipeUrl(
	urlString: string,
	createErrorResponse: (error: string, status: number) => Response,
): Response | null {
	try {
		const url = new URL(urlString);
		// Only allow HTTP and HTTPS protocols to prevent SSRF attacks
		// This blocks file://, javascript:, data:, and other dangerous protocols
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return createErrorResponse(
				"Invalid URL protocol. Only HTTP and HTTPS are allowed",
				SecurityHttpStatus.BadRequest,
			);
		}
		return null;
	} catch {
		return createErrorResponse("Invalid URL format", SecurityHttpStatus.BadRequest);
	}
}

/**
 * Validates the request body for recipe processing.
 *
 * @param body - The request body to validate.
 * @param createErrorResponse - Function to create error responses.
 * @returns Null if valid, or an error response if invalid.
 */
export function validateRecipeRequest(
	body: unknown,
	createErrorResponse: (error: string, status: number) => Response,
): Response | null {
	if (!body || typeof body !== "object") {
		return createErrorResponse("Missing request body", SecurityHttpStatus.BadRequest);
	}

	const request = body as RecipeRequest;
	if (!request.url || typeof request.url !== "string") {
		return createErrorResponse(
			"Missing or invalid 'url' field in request body",
			SecurityHttpStatus.BadRequest,
		);
	}

	// Validate URL format and protocol
	return validateRecipeUrl(request.url, createErrorResponse);
}

/**
 * Validates the Content-Length header to prevent large request body attacks.
 *
 * @param contentLength - The Content-Length header value.
 * @param maxSize - Maximum allowed size in bytes (default: MAX_REQUEST_BODY_SIZE).
 * @param createErrorResponse - Function to create error responses.
 * @returns Null if valid, or an error response if invalid.
 */
export function validateRequestSize(
	contentLength: string | null,
	maxSize: number = MAX_REQUEST_BODY_SIZE,
	createErrorResponse: (error: string, status: number) => Response,
): Response | null {
	if (!contentLength) {
		return null; // No size limit if Content-Length is not provided
	}

	const size = parseInt(contentLength, 10);
	if (Number.isNaN(size) || size > maxSize) {
		return createErrorResponse(
			`Request body too large. Maximum size is ${maxSize / 1024}KB`,
			SecurityHttpStatus.BadRequest,
		);
	}

	return null;
}
