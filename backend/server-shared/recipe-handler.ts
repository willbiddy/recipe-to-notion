/**
 * Shared recipe request handling logic for both server.ts and api/recipes.ts.
 * Reduces code duplication and ensures consistent behavior.
 */

import { consola } from "consola";
import { type RecipeResponse, ServerProgressEventType } from "../../shared/api/types.js";
import { loadConfig } from "../config.js";
import { createConsoleLogger } from "../logger.js";
import { getNotionPageUrl } from "../notion/client.js";
import { type ProgressEvent, processRecipe } from "../process-recipe.js";
import { checkRateLimit, getClientIdentifier } from "../rate-limit.js";
import {
	MAX_REQUEST_BODY_SIZE,
	type RecipeRequest,
	validateActualBodySize,
	validateApiKeyHeader,
	validateRecipeRequest,
	validateRequestSize,
} from "../security.js";
import { DEFAULT_RATE_LIMIT_VALUE, HttpStatus, RATE_LIMIT_HEADERS } from "./constants.js";
import { createRateLimitResponse, handleRecipeError, sanitizeError } from "./errors.js";
import { setCorsHeaders, setSecurityHeaders } from "./headers.js";

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
};

/**
 * Options for recipe stream handling.
 */
export type RecipeStreamOptions = {
	/**
	 * The recipe URL to process.
	 */
	url: string;
	/**
	 * Optional request correlation ID for logging.
	 */
	requestId?: string;
	/**
	 * Whether to include full recipe and tags data in the complete event (for Vercel API).
	 */
	includeFullData?: boolean;
};

/**
 * Handles recipe processing requests with Server-Sent Events for progress.
 *
 * Streams progress updates to the client as the recipe is processed.
 *
 * @param options - Stream handling options.
 * @returns Response with SSE stream for progress updates.
 */
export function handleRecipeStream(options: RecipeStreamOptions): Response {
	const { url, requestId, includeFullData = false } = options;
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: object) => {
				try {
					const message = `data: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (e) {
					consola.error("Error sending SSE event:", e);
				}
			};

			try {
				if (includeFullData) {
					sendEvent({
						type: ServerProgressEventType.Progress,
						message: "Starting...",
						progressType: "starting" as ProgressEvent["type"],
					});
				}

				const logger = createConsoleLogger();

				const result = await processRecipe({
					url,
					onProgress: (event: ProgressEvent) => {
						sendEvent({
							type: ServerProgressEventType.Progress,
							message: event.message,
							progressType: event.type,
						});
					},
					logger,
				});

				const notionUrl = getNotionPageUrl(result.pageId);
				const completeEvent: Record<string, unknown> = {
					type: ServerProgressEventType.Complete,
					success: true,
					pageId: result.pageId,
					notionUrl,
				};

				if (includeFullData) {
					completeEvent.recipe = {
						name: result.recipe.name,
						author: result.recipe.author,
						ingredients: result.recipe.ingredients,
						instructions: result.recipe.instructions,
					};
					completeEvent.tags = {
						tags: result.tags.tags,
						mealType: result.tags.mealType,
						healthiness: result.tags.healthiness,
						totalTimeMinutes: result.tags.totalTimeMinutes,
					};
				}

				sendEvent(completeEvent);
			} catch (error) {
				consola.error("Recipe processing error in stream:", error);
				const { logErrorDetails } = await import("./errors.js");
				logErrorDetails(error, { error: consola.error }, requestId);

				const { message, notionUrl } = sanitizeError(error, { error: consola.error }, requestId);

				try {
					sendEvent({
						type: ServerProgressEventType.Error,
						success: false,
						error: message,
						...(notionUrl && { notionUrl }),
					});
				} catch (e) {
					consola.error("Error sending error event:", e);
				}
			} finally {
				try {
					controller.close();
				} catch (e) {
					consola.error("Error closing stream:", e);
				}
			}
		},
	});

	const response = new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
	setCorsHeaders(response);
	return response;
}

/**
 * Handles recipe processing requests (non-streaming and streaming).
 *
 * Validates rate limit, authentication, request size, and URL before processing.
 * Supports both streaming and non-streaming responses based on the request body.
 *
 * @param options - Handler options including request and error response creator.
 * @returns Response with recipe processing result or error.
 */
export async function handleRecipeRequest(options: RecipeHandlerOptions): Promise<Response> {
	const { request, requestId, createErrorResponse } = options;

	const config = loadConfig();

	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(clientId);

	if (!rateLimit.allowed) {
		return createRateLimitResponse(rateLimit);
	}

	const authError = validateApiKeyHeader(
		request.headers.get("Authorization"),
		config.API_SECRET,
		createErrorResponse,
	);

	if (authError) {
		return authError;
	}

	const sizeError = validateRequestSize(
		request.headers.get("Content-Length"),
		MAX_REQUEST_BODY_SIZE,
		createErrorResponse,
	);

	if (sizeError) {
		return sizeError;
	}

	try {
		const body = options.parsedBody ?? ((await request.json()) as unknown);

		const actualSizeError = validateActualBodySize(
			body,
			MAX_REQUEST_BODY_SIZE,
			createErrorResponse,
		);
		if (actualSizeError) {
			return actualSizeError;
		}

		const validationResult = validateRecipeRequest(body, createErrorResponse);
		if (!validationResult.success) {
			return validationResult.response;
		}

		const validatedBody: RecipeRequest = validationResult.data;

		if (validatedBody.stream) {
			return handleRecipeStream({
				url: validatedBody.url,
				requestId,
				includeFullData: false,
			});
		}

		const logger = createConsoleLogger();
		const result = await processRecipe({ url: validatedBody.url, logger });

		const savedNotionUrl = getNotionPageUrl(result.pageId);

		const successResponse: RecipeResponse = {
			success: true,
			pageId: result.pageId,
			notionUrl: savedNotionUrl,
		};

		const response = Response.json(successResponse, {
			status: HttpStatus.OK,
			headers: {
				[RATE_LIMIT_HEADERS.LIMIT]: String(DEFAULT_RATE_LIMIT_VALUE),
				[RATE_LIMIT_HEADERS.REMAINING]: rateLimit.remaining.toString(),
				[RATE_LIMIT_HEADERS.RESET]: new Date(rateLimit.resetAt).toISOString(),
			},
		});
		setSecurityHeaders(response);
		setCorsHeaders(response, request);
		return response;
	} catch (error) {
		return handleRecipeError(error, { error: consola.error }, requestId);
	}
}
