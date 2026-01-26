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
			const response = new Response(null, { status: HttpStatus.NoContent });
			setSecurityHeaders(response);
			setCorsHeaders(response, req);
			return response;
		}

		if (req.method !== "POST") {
			return createErrorResponse("Method not allowed", HttpStatus.MethodNotAllowed, true);
		}

		const createErrorResponseWithLogging = (error: string, status: number): Response => {
			consola.error(`[${requestId}] Request error: ${error}`);
			return createErrorResponse(error, status, true);
		};

		try {
			const body = (await req.json()) as { url?: string; stream?: boolean };
			if (body.stream && typeof body.url === "string") {
				return handleRecipeStream({
					url: body.url,
					requestId,
					includeFullData: true,
				});
			}

			return await handleRecipeRequest({
				request: req,
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
