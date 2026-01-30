import { readFileSync } from "node:fs";
import { HttpStatus } from "@backend/server-shared/http-utils.js";
import { resolveIndexPath } from "./path-utils.js";

export default {
	/**
	 * Serves the web interface index page.
	 *
	 * @param req - The incoming request (for Vercel compatibility).
	 * @returns Response with HTML content or 404 error.
	 */
	fetch(_req: Request): Response {
		try {
			const indexPath = resolveIndexPath();

			if (!indexPath) {
				console.error("[api/index] Could not find index.html in any expected location");
				console.error("[api/index] Current working directory:", process.cwd());

				return Response.json(
					{
						success: false,
						error: "Failed to load the web interface. Please check the server logs.",
					},
					{ status: HttpStatus.InternalServerError },
				);
			}

			const html = readFileSync(indexPath, "utf-8");

			return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
		} catch (error) {
			console.error("[api/index] Error serving index.html:", error);
			console.error("[api/index] Error stack:", error instanceof Error ? error.stack : "No stack");

			return Response.json(
				{
					success: false,
					error: "Failed to load the web interface. Please check the server logs.",
				},
				{
					status: HttpStatus.InternalServerError,
				},
			);
		}
	},
};
