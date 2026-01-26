import { consola } from "consola";
import { HttpStatus } from "./server-shared/constants.js";
import { createErrorResponse, generateRequestId } from "./server-shared/errors.js";
import { handleOptionsRequest, setCorsHeaders } from "./server-shared/headers.js";
import { handleRecipeRequest } from "./server-shared/recipe-handler.js";

/**
 * Handles health check requests.
 *
 * @param request - The incoming request to extract origin from.
 * @returns Response with health status and CORS headers.
 */
function handleHealth(request: Request): Response {
	const response = Response.json({ status: "ok", service: "recipe-to-notion" });
	setCorsHeaders(response, request);
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
		return handleOptionsRequest(request);
	}

	if (url.pathname === "/health" && request.method === "GET") {
		return handleHealth(request);
	}

	if (url.pathname === "/api/recipes" && request.method === "POST") {
		return await handleRecipeRequest({
			request,
			requestId,
			createErrorResponse: (error: string, status: number) =>
				createErrorResponse(error, status, true),
		});
	}

	return createErrorResponse("Not found", HttpStatus.NotFound, true);
}
