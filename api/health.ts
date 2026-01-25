/**
 * Health check endpoint for Vercel serverless function.
 * Maps to GET /api/health
 */
export default function handler(req: Request): Response {
	const headers = {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	};

	// Handle CORS preflight
	if (req.method === "OPTIONS") {
		return new Response(null, { status: 204, headers });
	}

	return new Response(
		JSON.stringify({ status: "ok", service: "recipe-to-notion" }),
		{ status: 200, headers },
	);
}
