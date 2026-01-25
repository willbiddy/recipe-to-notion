/**
 * Shared server utilities for both Bun server and Vercel serverless functions.
 */

/**
 * HTTP status codes used throughout the server.
 */
export const HttpStatus = {
	OK: 200,
	NoContent: 204,
	BadRequest: 400,
	NotFound: 404,
	MethodNotAllowed: 405,
	Conflict: 409,
	InternalServerError: 500,
	BadGateway: 502,
} as const;

/**
 * Response format for the /api/recipes endpoint.
 */
export type RecipeResponse = {
	success: boolean;
	pageId?: string;
	notionUrl?: string;
	error?: string;
};

/**
 * Pattern to extract Notion URL from duplicate error messages.
 */
export const NOTION_URL_EXTRACTION_PATTERN = /View it at: (https:\/\/www\.notion\.so\/[^\s]+)/;

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

/**
 * Logger interface for error logging.
 */
export interface ErrorLogger {
	error(message: string, details?: unknown): void;
}

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

/**
 * Creates an error response with CORS headers.
 *
 * @param error - The error message to include in the response.
 * @param status - The HTTP status code for the error.
 * @param includeSecurityHeaders - Whether to include security headers (default: true).
 * @returns Response with error details and CORS headers.
 */
export function createErrorResponse(
	error: string,
	status: number,
	includeSecurityHeaders: boolean = true,
): Response {
	const errorResponse: RecipeResponse = {
		success: false,
		error,
	};
	const response = Response.json(errorResponse, { status });
	if (includeSecurityHeaders) {
		setSecurityHeaders(response);
	}
	setCorsHeaders(response);
	return response;
}

/**
 * Generates a unique request correlation ID.
 *
 * @returns A unique request ID string.
 */
export function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Sanitizes error messages for client responses.
 * Logs detailed errors server-side but returns generic messages to clients.
 *
 * @param error - The error that occurred.
 * @param logger - Logger instance for server-side error logging.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Sanitized error message for client and extracted Notion URL if duplicate.
 */
export function sanitizeError(
	error: unknown,
	logger: ErrorLogger,
	requestId?: string,
): { message: string; notionUrl?: string; statusCode: number } {
	const fullError = error instanceof Error ? error : new Error(String(error));
	const errorMessage = fullError.message;
	const isDuplicate = errorMessage.includes("Duplicate recipe found");

	// Log detailed error server-side
	const logPrefix = requestId ? `[${requestId}]` : "";
	logger.error(`${logPrefix} Recipe processing error:`, {
		message: errorMessage,
		stack: fullError.stack,
		name: fullError.name,
	});

	let statusCode: number = HttpStatus.InternalServerError;
	let clientMessage: string;
	let notionUrl: string | undefined;

	if (isDuplicate) {
		statusCode = HttpStatus.Conflict;
		// Duplicate errors are safe to return as-is (user-friendly)
		clientMessage = errorMessage;
		const urlMatch = errorMessage.match(NOTION_URL_EXTRACTION_PATTERN);
		if (urlMatch) {
			notionUrl = urlMatch[1];
		}
	} else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("403")) {
		statusCode = HttpStatus.BadGateway;
		// Network errors: return generic message but keep some context
		if (errorMessage.includes("403")) {
			clientMessage =
				"The recipe site blocked the request. Try saving the page source and using the --html option.";
		} else if (errorMessage.includes("timeout")) {
			clientMessage = "Request timed out. The recipe site may be slow or unresponsive.";
		} else {
			clientMessage =
				"Failed to fetch the recipe page. The site may be unavailable or blocking requests.";
		}
	} else if (errorMessage.includes("Invalid URL") || errorMessage.includes("URL")) {
		statusCode = HttpStatus.BadRequest;
		// URL validation errors are safe to return
		clientMessage = errorMessage;
	} else {
		// Generic internal errors: don't expose details
		clientMessage = "An error occurred while processing the recipe. Please try again.";
	}

	return { message: clientMessage, notionUrl, statusCode };
}

/**
 * Handles errors from recipe processing and returns appropriate response.
 *
 * Determines the correct HTTP status code based on error type (duplicate, scraping failure, etc.)
 * and extracts Notion URL from duplicate error messages.
 *
 * @param error - The error that occurred during recipe processing.
 * @param logger - Logger instance for server-side error logging.
 * @param requestId - Optional request correlation ID for logging.
 * @returns Response with appropriate status code and error details.
 */
export function handleRecipeError(
	error: unknown,
	logger: ErrorLogger,
	requestId?: string,
): Response {
	const { message, notionUrl, statusCode } = sanitizeError(error, logger, requestId);

	const errorResponse: RecipeResponse = {
		success: false,
		error: message,
		...(notionUrl && { notionUrl }),
	};

	const response = Response.json(errorResponse, { status: statusCode });
	setSecurityHeaders(response);
	setCorsHeaders(response);
	return response;
}
