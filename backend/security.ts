import { timingSafeEqual } from "node:crypto";
import { consola } from "consola";
import { z } from "zod";
import { MAX_REQUEST_BODY_SIZE, MAX_URL_LENGTH } from "../shared/constants.js";
import { isValidHttpUrl } from "../shared/url-utils.js";

/**
 * HTTP status codes used for security-related responses.
 */
export enum SecurityHttpStatus {
	BadRequest = 400,
	InternalServerError = 500,
}

// Re-export constants for backward compatibility
export { MAX_REQUEST_BODY_SIZE, MAX_URL_LENGTH };

/**
 * Bearer token prefix length.
 */
const BEARER_PREFIX_LENGTH = "Bearer ".length;

/**
 * Zod schema for RecipeRequest validation.
 */
export const recipeRequestSchema = z.object({
	url: z.string().min(1, "URL is required"),
	stream: z.boolean().optional(),
});

/**
 * Request body format for recipe endpoints.
 */
export type RecipeRequest = z.infer<typeof recipeRequestSchema>;

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Uses Bun's native crypto.timingSafeEqual for secure comparison. Converts strings to buffers
 * for timing-safe comparison. If buffer lengths differ, returns false immediately (still in
 * constant time). Handles errors gracefully if timingSafeEqual fails unexpectedly.
 *
 * @param a - First string to compare.
 * @param b - Second string to compare.
 * @returns True if strings are equal, false otherwise.
 */
export function constantTimeEquals(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a, "utf8");
	const bBuffer = Buffer.from(b, "utf8");

	if (aBuffer.length !== bBuffer.length) {
		return false;
	}

	try {
		return timingSafeEqual(aBuffer, bBuffer);
	} catch {
		return false;
	}
}

/**
 * Validates the API key from the Authorization header.
 * Returns null if valid, or an error response if invalid.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param authHeader - The Authorization header value.
 * @param expectedApiSecret - The expected API secret from validated config.
 * @param createErrorResponse - Function to create error responses (allows different response formats).
 * @returns Null if valid, or an error response if invalid.
 */
export function validateApiKeyHeader(
	authHeader: string | null,
	expectedApiSecret: string,
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

	const providedKey = authHeader.slice(BEARER_PREFIX_LENGTH).trim();
	const expectedKey = expectedApiSecret.trim();

	if (!expectedKey) {
		consola.error("API_SECRET is empty or invalid");
		return createErrorResponse(
			"Server configuration error",
			SecurityHttpStatus.InternalServerError,
		);
	}

	if (!constantTimeEquals(providedKey, expectedKey)) {
		return createErrorResponse("Invalid API key", SecurityHttpStatus.BadRequest);
	}

	return null;
}

/**
 * Validates a recipe URL to ensure it's safe to process.
 *
 * Validates URL length to prevent DoS attacks and only allows HTTP and HTTPS protocols
 * to prevent SSRF attacks. Blocks file://, javascript:, data:, and other dangerous protocols.
 *
 * @param urlString - The URL string to validate.
 * @param createErrorResponse - Function to create error responses.
 * @returns Null if valid, or an error response if invalid.
 */
export function validateRecipeUrl(
	urlString: string,
	createErrorResponse: (error: string, status: number) => Response,
): Response | null {
	if (urlString.length > MAX_URL_LENGTH) {
		return createErrorResponse(
			`URL too long (max ${MAX_URL_LENGTH} characters)`,
			SecurityHttpStatus.BadRequest,
		);
	}

	// Use shared URL validation for protocol check
	if (!isValidHttpUrl(urlString)) {
		return createErrorResponse(
			"Invalid URL protocol. Only HTTP and HTTPS are allowed",
			SecurityHttpStatus.BadRequest,
		);
	}

	try {
		new URL(urlString);
		return null;
	} catch {
		return createErrorResponse("Invalid URL format", SecurityHttpStatus.BadRequest);
	}
}

/**
 * Validates the request body for recipe processing.
 *
 * Uses Zod schema validation to ensure type safety and proper structure.
 *
 * @param body - The request body to validate.
 * @param createErrorResponse - Function to create error responses.
 * @returns Validated RecipeRequest if valid, or an error response if invalid.
 */
export function validateRecipeRequest(
	body: unknown,
	createErrorResponse: (error: string, status: number) => Response,
): { success: true; data: RecipeRequest } | { success: false; response: Response } {
	const parseResult = recipeRequestSchema.safeParse(body);

	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join(", ");
		return {
			success: false,
			response: createErrorResponse(
				`Invalid request body: ${errorMessage}`,
				SecurityHttpStatus.BadRequest,
			),
		};
	}

	const urlValidationError = validateRecipeUrl(parseResult.data.url, createErrorResponse);
	if (urlValidationError) {
		return { success: false, response: urlValidationError };
	}

	return { success: true, data: parseResult.data };
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
		return null;
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

/**
 * Validates the actual request body size after parsing.
 *
 * This provides defense-in-depth by validating the actual body size,
 * not just the Content-Length header, which could be incorrect or manipulated.
 *
 * @param body - The parsed request body object.
 * @param maxSize - Maximum allowed size in bytes (default: MAX_REQUEST_BODY_SIZE).
 * @param createErrorResponse - Function to create error responses.
 * @returns Null if valid, or an error response if invalid.
 */
export function validateActualBodySize(
	body: unknown,
	maxSize: number = MAX_REQUEST_BODY_SIZE,
	createErrorResponse: (error: string, status: number) => Response,
): Response | null {
	try {
		const bodyString = JSON.stringify(body);
		const bodySize = new TextEncoder().encode(bodyString).length;

		if (bodySize > maxSize) {
			return createErrorResponse(
				`Request body too large. Maximum size is ${maxSize / 1024}KB`,
				SecurityHttpStatus.BadRequest,
			);
		}

		return null;
	} catch {
		return null;
	}
}
