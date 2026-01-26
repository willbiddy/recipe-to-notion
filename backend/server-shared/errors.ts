import type { RecipeResponse } from "../../shared/api/types.js";
import {
	DuplicateRecipeError,
	NotionApiError,
	ParseError,
	ScrapingError,
	TaggingError,
	ValidationError,
} from "../errors.js";
import { DEFAULT_RATE_LIMIT_VALUE, HttpStatus, RATE_LIMIT_HEADERS } from "./constants.js";
import { setCorsHeaders, setSecurityHeaders } from "./headers.js";

/**
 * Logger interface for error logging.
 */
export type ErrorLogger = {
	error(message: string, details?: unknown): void;
};

/**
 * Handles duplicate recipe errors.
 *
 * Extracts the Notion URL from the duplicate error and returns it along with
 * the error message for client display.
 *
 * @param error - The duplicate recipe error.
 * @returns Error response with Conflict status code, message, and Notion URL.
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
 *
 * Provides user-friendly error messages based on the error type: 403 Forbidden
 * suggests using the --html option, timeout errors indicate slow/unresponsive sites,
 * and other errors indicate general fetch failures.
 *
 * @param error - The scraping error that occurred.
 * @returns Error response with appropriate status code and user-friendly message.
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
 * Handles generic errors by checking message content for backward compatibility.
 *
 * Checks if the error message contains URL-related keywords to determine if it's
 * a validation error (BadRequest) or a generic server error (InternalServerError).
 *
 * @param errorMessage - The error message to analyze.
 * @returns Error response with appropriate status code and message.
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
 *
 * Logs detailed errors server-side with full stack traces and error details, but returns
 * generic messages to clients for security. Uses instanceof checks for type-safe error
 * handling with custom error classes. For generic errors, checks message content for
 * backward compatibility with legacy error formats.
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

	return handleGenericError(fullError.message);
}

/**
 * Logs detailed error information for debugging.
 *
 * Provides comprehensive error logging with stack traces, error causes, and type information.
 * Useful for server-side debugging while keeping client messages sanitized.
 *
 * @param error - The error that occurred.
 * @param logger - Logger instance for error logging.
 * @param context - Optional context string to include in log messages.
 */
export function logErrorDetails(error: unknown, logger: ErrorLogger, context?: string): void {
	const contextPrefix = context ? `[${context}] ` : "";

	if (error instanceof Error) {
		logger.error(`${contextPrefix}Error name:`, error.name);
		logger.error(`${contextPrefix}Error message:`, error.message);
		logger.error(`${contextPrefix}Error stack:`, error.stack);

		if ("cause" in error && error.cause) {
			logger.error(`${contextPrefix}Error cause:`, error.cause);
		}
	} else {
		logger.error(`${contextPrefix}Error type:`, typeof error);
		logger.error(`${contextPrefix}Error value:`, JSON.stringify(error, null, 2));
	}
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

/**
 * Creates a rate limit error response.
 *
 * @param rateLimit - Rate limit information.
 * @returns Response with rate limit error and headers.
 */
export function createRateLimitResponse(rateLimit: {
	allowed: boolean;
	resetAt: number;
}): Response {
	const response = Response.json(
		{
			success: false,
			error: "Rate limit exceeded. Please try again later.",
		},
		{
			status: 429,
			headers: {
				[RATE_LIMIT_HEADERS.LIMIT]: String(DEFAULT_RATE_LIMIT_VALUE),
				[RATE_LIMIT_HEADERS.REMAINING]: "0",
				[RATE_LIMIT_HEADERS.RESET]: new Date(rateLimit.resetAt).toISOString(),
			},
		},
	);
	setSecurityHeaders(response);
	setCorsHeaders(response);
	return response;
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
