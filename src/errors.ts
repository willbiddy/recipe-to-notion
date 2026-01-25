/**
 * Custom error classes for type-safe error handling throughout the application.
 *
 * Using custom error classes provides:
 * - Type-safe instanceof checks instead of fragile string matching
 * - Structured metadata (status codes, URLs, etc.) attached to errors
 * - Better error organization and maintainability
 * - Easier extension with new error types
 */

/**
 * Base error class for all application errors.
 * Provides a consistent structure for error handling.
 */
export class AppError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = this.constructor.name;
		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

/**
 * Error thrown when a duplicate recipe is detected (same URL or title).
 */
export class DuplicateRecipeError extends AppError {
	constructor(
		public readonly title: string,
		public readonly url: string,
		public readonly notionUrl: string,
	) {
		super(
			`Duplicate recipe found: "${title}" (${url}) already exists in the database. View it at: ${notionUrl}`,
		);
	}
}

/**
 * Error thrown when recipe scraping fails.
 */
export class ScrapingError extends AppError {
	constructor(
		message: string,
		public readonly originalUrl: string,
		public readonly statusCode?: number,
		cause?: unknown,
	) {
		super(message, cause);
	}
}

/**
 * Error thrown when the Notion API returns an error response.
 */
export class NotionApiError extends AppError {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly propertyName?: string,
		public readonly propertyType?: string,
		cause?: unknown,
	) {
		super(message, cause);
	}
}

/**
 * Error thrown when validation fails (config, input, etc.).
 */
export class ValidationError extends AppError {}

/**
 * Error thrown when AI tagging/analysis fails.
 */
export class TaggingError extends AppError {}

/**
 * Error thrown when parsing recipe data fails.
 */
export class ParseError extends AppError {
	constructor(
		message: string,
		public readonly sourceUrl?: string,
		cause?: unknown,
	) {
		super(message, cause);
	}
}
