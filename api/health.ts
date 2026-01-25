/**
 * Health check endpoint for Vercel serverless function.
 * Maps to GET /api/health
 */

/**
 * HTTP status codes used in the health endpoint.
 */
const HttpStatus = {
	OK: 200,
	NoContent: 204,
} as const;

/**
 * Service name for health check responses.
 */
const SERVICE_NAME = "recipe-to-notion";

/**
 * CORS headers for health check endpoint.
 */
const CORS_HEADERS = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
} as const;

export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with health status.
	 */
	fetch(req: Request): Response {
		if (req.method === "OPTIONS") {
			return new Response(null, { status: HttpStatus.NoContent, headers: CORS_HEADERS });
		}

		const responseBody = JSON.stringify({ status: "ok", service: SERVICE_NAME });
		return new Response(responseBody, {
			status: HttpStatus.OK,
			headers: CORS_HEADERS,
		});
	},
};
