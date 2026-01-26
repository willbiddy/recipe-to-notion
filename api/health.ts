/**
 * Health check endpoint for Vercel serverless function.
 * Maps to GET /api/health
 */

import { HttpStatus } from "../backend/server-shared/constants.js";
import {
	handleOptionsRequest,
	setCorsHeaders,
	setSecurityHeaders,
} from "../backend/server-shared/headers.js";

/**
 * Service name for health check responses.
 *
 * Used in health check endpoint responses to identify the service.
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
			return handleOptionsRequest(req);
		}

		const response = Response.json(
			{ status: "ok", service: SERVICE_NAME },
			{
				status: HttpStatus.OK,
			},
		);
		setSecurityHeaders(response);
		setCorsHeaders(response, req);
		return response;
	},
};
