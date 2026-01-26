/**
 * Health check endpoint for Vercel serverless function.
 * Maps to GET /api/health
 */

import { HttpStatus } from "../backend/server-shared/constants.js";

import { setCorsHeaders, setSecurityHeaders } from "../backend/server-shared/headers.js";

/**
 * Service name for health check responses.
 */
const SERVICE_NAME = "recipe-to-notion";

export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with health status.
	 */
	fetch(req: Request): Response {
		if (req.method === "OPTIONS") {
			const response = new Response(null, { status: HttpStatus.NoContent });
			setSecurityHeaders(response);
			setCorsHeaders(response);
			return response;
		}

		const response = Response.json(
			{ status: "ok", service: SERVICE_NAME },
			{
				status: HttpStatus.OK,
			},
		);
		setSecurityHeaders(response);
		setCorsHeaders(response);
		return response;
	},
};
