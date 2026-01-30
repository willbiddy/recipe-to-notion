/**
 * Recipe request validation logic.
 * Handles configuration, rate limiting, authentication, and request body validation.
 */

import { type Config, loadConfig } from "../config.js";
import { ValidationError } from "../errors.js";
import { checkRateLimit, getRateLimitIdentifier } from "../rate-limit.js";

/**
 * Result from rate limit check.
 */
type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

import {
	MAX_REQUEST_BODY_SIZE,
	type RecipeRequest,
	validateActualBodySize,
	validateApiKeyHeader,
	validateRecipeRequest,
	validateRequestSize,
} from "../security.js";
import { setCorsHeaders } from "./http-utils.js";

/**
 * Result of request validation.
 * Contains either the validated data or an error response.
 */
export type ValidationResult =
	| {
			success: true;
			data: RecipeRequest;
			config: Config;
			rateLimit: RateLimitResult;
	  }
	| {
			success: false;
			response: Response;
	  };

/**
 * Options for validating recipe requests.
 */
export type ValidateRecipeRequestOptions = {
	/**
	 * The incoming HTTP request.
	 */
	request: Request;
	/**
	 * Optional pre-parsed request body (if request body has already been consumed).
	 */
	parsedBody?: RecipeRequest;
	/**
	 * Optional request correlation ID for logging.
	 */
	requestId?: string;
	/**
	 * Function to create error responses (allows different response formats).
	 */
	createErrorResponse: (error: string, status: number) => Response;
};

/**
 * Validates a recipe request through multiple layers:
 * 1. Configuration loading
 * 2. Rate limiting
 * 3. API key authentication
 * 4. Request size validation
 * 5. Body parsing and schema validation
 *
 * @param options - Validation options including request and error response creator
 * @returns Validation result with either validated data or error response
 */
export async function validateRecipeRequestChain(
	options: ValidateRecipeRequestOptions,
): Promise<ValidationResult> {
	const { request, requestId, createErrorResponse, parsedBody } = options;

	// 1. Load and validate configuration
	let config: Config;
	try {
		config = loadConfig();
	} catch (error) {
		console.error(`[${requestId}] Configuration error:`, error);
		if (error instanceof ValidationError) {
			const response = createErrorResponse(
				"Server configuration error: Missing or invalid environment variables. Please check your Vercel environment variables.",
				500, // HttpStatus.InternalServerError
			);
			setCorsHeaders(response, request);
			return { success: false, response };
		}
		throw error; // Re-throw if it's not a ValidationError
	}

	// 2. Check rate limiting
	const clientId = getRateLimitIdentifier(request);
	const rateLimit = checkRateLimit(clientId);

	if (!rateLimit.allowed) {
		const { createRateLimitResponse } = await import("./errors.js");
		return { success: false, response: createRateLimitResponse(rateLimit) };
	}

	// 3. Validate API key
	const authError = validateApiKeyHeader(
		request.headers.get("Authorization"),
		config.API_SECRET,
		createErrorResponse,
	);

	if (authError) {
		return { success: false, response: authError };
	}

	// 4. Validate request size (header check)
	const sizeError = validateRequestSize(
		request.headers.get("Content-Length"),
		MAX_REQUEST_BODY_SIZE,
		createErrorResponse,
	);

	if (sizeError) {
		return { success: false, response: sizeError };
	}

	// 5. Parse and validate body
	try {
		const body = parsedBody ?? ((await request.json()) as unknown);

		// Validate actual body size
		const actualSizeError = validateActualBodySize(
			body,
			MAX_REQUEST_BODY_SIZE,
			createErrorResponse,
		);
		if (actualSizeError) {
			return { success: false, response: actualSizeError };
		}

		// Validate body schema
		const validationResult = validateRecipeRequest(body, createErrorResponse);
		if (!validationResult.success) {
			return { success: false, response: validationResult.response };
		}

		return {
			success: true,
			data: validationResult.data,
			config,
			rateLimit,
		};
	} catch (error) {
		const response = createErrorResponse(
			`Invalid JSON body: ${error instanceof Error ? error.message : "Unknown error"}`,
			400, // HttpStatus.BadRequest
		);
		return { success: false, response };
	}
}
