/**
 * Shared server utilities for both Bun server and Vercel serverless functions.
 */
import {
	DuplicateRecipeError,
	NotionApiError,
	ParseError,
	ScrapingError,
	TaggingError,
	ValidationError,
} from "./errors.js";

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
export type ErrorLogger = {
	error(message: string, details?: unknown): void;
};

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
 * Handles duplicate recipe errors.
 */
function handleDuplicateError(error: DuplicateRecipeError): {
	message: string;
	notionUrl: string;
	statusCode: number;
} {
	return {
		statusCode: HttpStatus.Conflict,
		message: error.message,
		notionUrl: error.notionUrl,
	};
}

/**
 * Handles scraping errors with appropriate client messages.
 */
function handleScrapingError(error: ScrapingError): {
	message: string;
	statusCode: number;
} {
	const statusCode = error.statusCode || HttpStatus.BadGateway;
	let message: string;

	if (error.statusCode === 403) {
		message =
			"The recipe site blocked the request. Try saving the page source and using the --html option.";
	} else if (error.message.includes("timeout")) {
		message = "Request timed out. The recipe site may be slow or unresponsive.";
	} else {
		message = "Failed to fetch the recipe page. The site may be unavailable or blocking requests.";
	}

	return { message, statusCode };
}

/**
 * Handles generic errors by checking message content.
 */
function handleGenericError(errorMessage: string): {
	message: string;
	statusCode: number;
} {
	if (errorMessage.includes("Invalid URL") || errorMessage.includes("URL")) {
		return {
			statusCode: HttpStatus.BadRequest,
			message: errorMessage,
		};
	}
	return {
		statusCode: HttpStatus.InternalServerError,
		message: "An error occurred while processing the recipe. Please try again.",
	};
}

/**
 * Sanitizes error messages for client responses.
 * Logs detailed errors server-side but returns generic messages to clients.
 *
 * Uses instanceof checks for type-safe error handling with custom error classes.
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

	// Log detailed error server-side
	const logPrefix = requestId ? `[${requestId}]` : "";
	const errorDetails: Record<string, unknown> = {
		message: fullError.message,
		stack: fullError.stack,
		name: fullError.name,
	};
	if (error instanceof Error && error.cause && typeof error.cause === "object") {
		errorDetails.cause = error.cause;
	}
	logger.error(`${logPrefix} Recipe processing error:`, errorDetails);

	// Type-safe error handling using instanceof checks
	if (error instanceof DuplicateRecipeError) {
		return handleDuplicateError(error);
	}

	if (error instanceof ScrapingError) {
		return handleScrapingError(error);
	}

	if (error instanceof NotionApiError) {
		return {
			statusCode: HttpStatus.BadGateway,
			message: "Failed to save recipe to Notion. Please check your Notion API configuration.",
		};
	}

	if (error instanceof ValidationError) {
		return {
			statusCode: HttpStatus.BadRequest,
			message: error.message,
		};
	}

	if (error instanceof ParseError || error instanceof TaggingError) {
		return {
			statusCode: HttpStatus.InternalServerError,
			message: "An error occurred while processing the recipe. Please try again.",
		};
	}

	// Generic errors: check message for backward compatibility
	return handleGenericError(fullError.message);
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
