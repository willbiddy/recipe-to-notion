/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */

import { consola } from "consola";
import { HttpStatus } from "../backend/server-shared/constants.js";
import { createErrorResponse, generateRequestId } from "../backend/server-shared/errors.js";
import { setCorsHeaders, setSecurityHeaders } from "../backend/server-shared/headers.js";
import {
	handleRecipeRequest,
	handleRecipeStream,
} from "../backend/server-shared/recipe-handler.js";

/**
 * Main handler for the /api/recipes endpoint.
 */
export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with recipe processing result or error.
	 */
	async fetch(req: Request): Promise<Response> {
		const requestId = generateRequestId();

		if (req.method === "OPTIONS") {
			const headers = new Headers();
			headers.set("X-Content-Type-Options", "nosniff");
			headers.set("X-Frame-Options", "DENY");
			headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
			headers.set("Access-Control-Allow-Origin", "*");
			headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
			headers.set("Access-Control-Expose-Headers", "*");
			headers.set("Access-Control-Allow-Credentials", "false");
			return new Response(null, { status: 204, headers });
		}

		if (req.method !== "POST") {
			const response = Response.json(
				{ error: "Method not allowed" },
				{ status: HttpStatus.MethodNotAllowed },
			);
			setSecurityHeaders(response);
			setCorsHeaders(response);
			return response;
		}

		// Create error response function that logs errors with request ID
		const createErrorResponseWithLogging = (error: string, status: number): Response => {
			consola.error(`[${requestId}] Request error: ${error}`);
			return createErrorResponse(error, status, false);
		};

		// Parse and validate request body
		try {
			const body = (await req.json()) as unknown;
			const { validateRecipeRequest } = await import("../backend/security.js");
			const validationResult = validateRecipeRequest(body, createErrorResponseWithLogging);

			if (!validationResult.success) {
				return validationResult.response;
			}

			// If streaming, use the enhanced stream handler with full data
			if (validationResult.data.stream) {
				return handleRecipeStream({
					url: validationResult.data.url,
					requestId,
					includeFullData: true,
				});
			}

			// For non-streaming, use the shared handler with pre-parsed body
			// Create a new request object since the body was already consumed
			const reconstructedRequest = new Request(req.url, {
				method: req.method,
				headers: req.headers,
			});

			return await handleRecipeRequest({
				request: reconstructedRequest,
				parsedBody: validationResult.data,
				requestId,
				createErrorResponse: createErrorResponseWithLogging,
			});
		} catch (error) {
			consola.error(`[${requestId}] Recipe processing error:`, error);
			const { handleRecipeError, logErrorDetails } = await import(
				"../backend/server-shared/errors.js"
			);
			logErrorDetails(error, { error: consola.error }, requestId);
			return handleRecipeError(error, { error: consola.error }, requestId);
		}
	},
};
