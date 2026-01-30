import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSET_ROUTES } from "@api/asset-routes";
import { resolveIndexPath, resolveWebDir } from "@api/path-utils";
import { createErrorResponse, generateRequestId } from "./server-shared/errors";
import { HttpStatus, handleOptionsRequest, setCorsHeaders } from "./server-shared/http-utils";
import { handleRecipeRequest } from "./server-shared/recipe-handler";

/**
 * Serves static assets from the web directory.
 */
function handleAsset(request: Request): Response {
	const url = new URL(request.url);
	const pathname = url.pathname.replace(/^\/api\//, "/");
	const asset = ASSET_ROUTES[pathname];

	if (!asset) {
		return createErrorResponse("Not found", HttpStatus.NotFound, true);
	}

	const webDir = resolveWebDir();
	if (!webDir) {
		return createErrorResponse("Web directory not found", HttpStatus.InternalServerError, true);
	}

	const filePath = join(webDir, asset.path);

	if (!existsSync(filePath)) {
		return createErrorResponse("Asset not found", HttpStatus.NotFound, true);
	}

	const content = asset.isText ? readFileSync(filePath, "utf-8") : readFileSync(filePath);

	const response = new Response(content, {
		headers: {
			"Content-Type": asset.contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
	setCorsHeaders(response, request);
	return response;
}

/**
 * Serves the web interface index page.
 */
function handleIndex(request: Request): Response {
	const indexPath = resolveIndexPath();

	if (!indexPath || !existsSync(indexPath)) {
		console.error("[handleIndex] Index file not found!");
		console.error("[handleIndex] Current working directory:", process.cwd());
		console.error("[handleIndex] Web directory:", resolveWebDir());
		return createErrorResponse(
			"Web interface not found. Please run 'bun run build:web' first.",
			HttpStatus.InternalServerError,
			true,
		);
	}

	const html = readFileSync(indexPath, "utf-8");
	const response = new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
		},
	});
	setCorsHeaders(response, request);
	return response;
}

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
		console.log(`${idPrefix} ${request.method} ${url.pathname}`);
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

	// Serve web interface assets
	if (url.pathname.startsWith("/api/") && request.method === "GET") {
		return handleAsset(request);
	}

	// Serve web interface index page
	if (url.pathname === "/" && request.method === "GET") {
		return handleIndex(request);
	}

	return createErrorResponse("Not found", HttpStatus.NotFound, true);
}
