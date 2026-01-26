/**
 * Base error class for all application errors.
 *
 * Provides a consistent structure for error handling. Maintains proper stack
 * trace for where our error was thrown (only available on V8 via Error.captureStackTrace).
 */
export class AppError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = this.constructor.name;
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
 * Options for creating a ScrapingError.
 */
export type ScrapingErrorOptions = {
	message: string;
	originalUrl: string;
	statusCode?: number;
	cause?: unknown;
};

/**
 * Error thrown when recipe scraping fails.
 */
export class ScrapingError extends AppError {
	public readonly originalUrl: string;
	public readonly statusCode?: number;

	constructor(options: ScrapingErrorOptions) {
		super(options.message, options.cause);
		this.originalUrl = options.originalUrl;
		this.statusCode = options.statusCode;
	}
}

/**
 * Options for creating a NotionApiError.
 */
export type NotionApiErrorOptions = {
	message: string;
	statusCode: number;
	propertyName?: string;
	propertyType?: string;
	cause?: unknown;
};

/**
 * Error thrown when the Notion API returns an error response.
 */
export class NotionApiError extends AppError {
	public readonly statusCode: number;
	public readonly propertyName?: string;
	public readonly propertyType?: string;

	constructor(options: NotionApiErrorOptions) {
		super(options.message, options.cause);
		this.statusCode = options.statusCode;
		this.propertyName = options.propertyName;
		this.propertyType = options.propertyType;
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
