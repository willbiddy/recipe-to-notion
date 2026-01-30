/**
 * Error types used throughout the application.
 */
export enum ErrorType {
	Duplicate = "duplicate",
	Scraping = "scraping",
	NotionApi = "notion_api",
	Validation = "validation",
	Tagging = "tagging",
	Parse = "parse",
}

/** Base error class for all application errors. */
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

/** Error thrown when a duplicate recipe is detected. */
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

/** Error thrown when recipe scraping fails. */
export class ScrapingError extends AppError {
	public readonly originalUrl: string;
	public readonly statusCode?: number;

	constructor(options: {
		message: string;
		originalUrl: string;
		statusCode?: number;
		cause?: unknown;
	}) {
		super(options.message, options.cause);
		this.originalUrl = options.originalUrl;
		this.statusCode = options.statusCode;
	}
}

/** Error thrown when the Notion API returns an error. */
export class NotionApiError extends AppError {
	public readonly statusCode: number;
	public readonly propertyName?: string;
	public readonly propertyType?: string;

	constructor(options: {
		message: string;
		statusCode: number;
		propertyName?: string;
		propertyType?: string;
		cause?: unknown;
	}) {
		super(options.message, options.cause);
		this.statusCode = options.statusCode;
		this.propertyName = options.propertyName;
		this.propertyType = options.propertyType;
	}
}

/** Error thrown when validation fails. */
export class ValidationError extends AppError {}

/** Error thrown when AI tagging fails. */
export class TaggingError extends AppError {}

/** Error thrown when parsing recipe data fails. */
export class ParseError extends AppError {
	constructor(
		message: string,
		public readonly sourceUrl?: string,
		cause?: unknown,
	) {
		super(message, cause);
	}
}

/**
 * Gets the error type from an error instance.
 *
 * @param error - The error to check.
 * @returns The ErrorType enum value, or null if not a known error.
 */
export function getErrorType(error: unknown): ErrorType | null {
	if (error instanceof DuplicateRecipeError) return ErrorType.Duplicate;
	if (error instanceof ScrapingError) return ErrorType.Scraping;
	if (error instanceof NotionApiError) return ErrorType.NotionApi;
	if (error instanceof ValidationError) return ErrorType.Validation;
	if (error instanceof TaggingError) return ErrorType.Tagging;
	if (error instanceof ParseError) return ErrorType.Parse;
	return null;
}
