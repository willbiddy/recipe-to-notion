/**
 * Health check endpoint for Vercel serverless function.
 * Maps to GET /api/health
 */

import {
	HttpStatus,
	handleOptionsRequest,
	setCorsHeaders,
	setSecurityHeaders,
} from "@backend/server-shared/http-utils";

export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with health status.
	 */
	fetch(req: Request): Response {
		if (req.method === "OPTIONS") {
			return handleOptionsRequest(req);
		}

		const response = Response.json(
			{ status: "ok", service: "recipe-to-notion" },
			{ status: HttpStatus.OK },
		);

		setSecurityHeaders(response);
		setCorsHeaders(response, req);
		return response;
	},
};
