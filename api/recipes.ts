/**
 * Recipe processing endpoint for Vercel serverless function.
 * Maps to POST /api/recipes
 *
 * Supports both streaming (SSE) and non-streaming responses.
 */

import { consola } from "consola";
import { HttpStatus } from "../backend/server-shared/constants.js";
import { createErrorResponse, generateRequestId } from "../backend/server-shared/errors.js";
import { handleOptionsRequest } from "../backend/server-shared/headers.js";
import { handleRecipeRequest } from "../backend/server-shared/recipe-handler.js";

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
			return handleOptionsRequest(req);
		}

		if (req.method !== "POST") {
			return createErrorResponse("Method not allowed", HttpStatus.MethodNotAllowed, true);
		}

		const createLoggedErrorResponse = (error: string, status: number): Response => {
			consola.error(`[${requestId}] Request error: ${error}`);
			return createErrorResponse(error, status, true);
		};

		try {
			return await handleRecipeRequest({
				request: req,
				requestId,
				createErrorResponse: createLoggedErrorResponse,
				includeFullDataInStream: true,
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
