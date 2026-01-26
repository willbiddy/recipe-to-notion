import { consola } from "consola";
import { HttpStatus } from "./server-shared/constants.js";
import { createErrorResponse, generateRequestId } from "./server-shared/errors.js";
import { setCorsHeaders } from "./server-shared/headers.js";
import { handleRecipeRequest } from "./server-shared/recipe-handler.js";

/**
 * Handles OPTIONS preflight requests for CORS.
 *
 * @returns Response with CORS headers and 204 No Content status.
 */
function handleOptions(): Response {
	const response = new Response(null, { status: HttpStatus.NoContent });
	setCorsHeaders(response);
	return response;
}

/**
 * Handles health check requests.
 *
 * @returns Response with health status and CORS headers.
 */
function handleHealth(): Response {
	const response = Response.json({ status: "ok", service: "recipe-to-notion" });
	setCorsHeaders(response);
	return response;
}

/**
 * Logs incoming requests with correlation ID.
 *
 * Only logs non-health-check requests to reduce noise.
 *
 * @param request - The incoming HTTP request to log.
 * @param requestId - Optional request correlation ID.
 */
function logRequest(request: Request, requestId?: string): void {
	const url = new URL(request.url);

	if (url.pathname !== "/health") {
		const idPrefix = requestId ? `[${requestId}]` : "";
		consola.info(`${idPrefix} ${request.method} ${url.pathname}`);
	}
}

/**
 * Creates an error response with CORS and security headers.
 *
 * @param error - The error message to include in the response.
 * @param status - The HTTP status code for the error.
 * @returns Response with error details and CORS headers.
 */
function createErrorResponseWithHeaders(error: string, status: number): Response {
	return createErrorResponse(error, status, true);
}

/**
 * Main request handler for the HTTP server.
 *
 * Routes requests to appropriate handlers based on path and method.
 * Handles CORS, health checks, and recipe processing.
 *
 * @param request - The incoming HTTP request.
 * @returns Response for the request.
 */
export async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const requestId = generateRequestId();

	logRequest(request, requestId);

	if (request.method === "OPTIONS") {
		return handleOptions();
	}

	if (url.pathname === "/health" && request.method === "GET") {
		return handleHealth();
	}

	if (url.pathname === "/api/recipes" && request.method === "POST") {
		return await handleRecipeRequest({
			request,
			requestId,
			createErrorResponse: createErrorResponseWithHeaders,
		});
	}

	const response = Response.json({ error: "Not found" }, { status: HttpStatus.NotFound });
	setCorsHeaders(response);
	return response;
}
