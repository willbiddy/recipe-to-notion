/**
 * Shared recipe request handling logic for both server.ts and api/recipes.ts.
 * Orchestrates validation, streaming, and non-streaming recipe processing.
 *
 * This module has been refactored into smaller, focused modules:
 * - recipe-validation.ts: Request validation chain (auth, rate limit, body parsing)
 * - recipe-streaming.ts: SSE streaming for progress updates
 * - recipe-handler.ts (this file): Orchestration and non-streaming responses
 */

import type { RecipeResponse } from "@shared/api/types";
import { createConsoleLogger } from "../logger";
import { getNotionPageUrl } from "../notion/notion-client";
import { processRecipe } from "../process-recipe";
import type { RecipeRequest } from "../security";
import { handleRecipeError } from "./errors";
import {
	DEFAULT_RATE_LIMIT_VALUE,
	HttpStatus,
	RateLimitHeader,
	setCorsHeaders,
	setSecurityHeaders,
} from "./http-utils";
import { handleRecipeStream } from "./recipe-streaming";
import { validateRecipeRequestChain } from "./recipe-validation";

/**
 * Options for handling recipe requests.
 */
export type RecipeHandlerOptions = {
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
	/**
	 * Whether to include full recipe and tags data in streaming responses (for Vercel API).
	 */
	includeFullDataInStream?: boolean;
};

/**
 * Handles recipe processing requests (non-streaming and streaming).
 *
 * Request processing flow:
 * 1. Validates configuration, rate limit, authentication, and request body (via recipe-validation.ts)
 * 2. Routes to streaming handler if stream=true (via recipe-streaming.ts)
 * 3. Otherwise, processes recipe and returns JSON response
 * 4. Includes rate limit headers in all responses
 * 5. Applies CORS and security headers
 *
 * @param options - Handler options including request and error response creator
 * @returns Response with recipe processing result or error
 */
export async function handleRecipeRequest(options: RecipeHandlerOptions): Promise<Response> {
	const { request, requestId, createErrorResponse, includeFullDataInStream = false } = options;

	// Step 1: Validate request through the complete validation chain
	const validationResult = await validateRecipeRequestChain({
		request,
		parsedBody: options.parsedBody,
		requestId,
		createErrorResponse,
	});

	if (!validationResult.success) {
		// Validation failed - return error response
		return validationResult.response;
	}

	const { data: validatedBody, rateLimit } = validationResult;

	// Step 2: Route to streaming or non-streaming handler
	if (validatedBody.stream) {
		// Streaming response via SSE
		return handleRecipeStream({
			url: validatedBody.url,
			requestId,
			includeFullData: includeFullDataInStream,
		});
	}

	// Step 3: Non-streaming response
	try {
		const logger = createConsoleLogger();
		const result = await processRecipe({ url: validatedBody.url, logger });

		const savedNotionUrl = getNotionPageUrl(result.pageId);

		const successResponse: RecipeResponse = {
			success: true,
			pageId: result.pageId,
			notionUrl: savedNotionUrl,
		};

		// Step 4: Build response with rate limit headers
		const response = Response.json(successResponse, {
			status: HttpStatus.OK,
			headers: {
				[RateLimitHeader.Limit]: String(DEFAULT_RATE_LIMIT_VALUE),
				[RateLimitHeader.Remaining]: rateLimit.remaining.toString(),
				[RateLimitHeader.Reset]: new Date(rateLimit.resetAt).toISOString(),
			},
		});

		// Step 5: Apply security and CORS headers
		setSecurityHeaders(response);
		setCorsHeaders(response, request);
		return response;
	} catch (error) {
		// Step 6: Handle recipe processing errors
		return handleRecipeError(error, { error: console.error }, requestId);
	}
}
