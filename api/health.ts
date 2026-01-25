/**
 * Health check endpoint for Vercel serverless function.
 * Maps to GET /api/health
 */

/**
 * HTTP status codes used in the health endpoint.
 */
enum HttpStatus {
	OK = 200,
	NoContent = 204,
}

export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with health status.
	 */
	fetch(req: Request): Response {
		const headers = {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (req.method === "OPTIONS") {
			return new Response(null, { status: HttpStatus.NoContent, headers });
		}

		return new Response(JSON.stringify({ status: "ok", service: "recipe-clipper-for-notion" }), {
			status: HttpStatus.OK,
			headers,
		});
	},
};
