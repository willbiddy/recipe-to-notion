/**
 * Serves the web interface index page.
 * This allows the root path (/) to serve the HTML file from public/.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HttpStatus } from "../backend/server-shared/constants.js";

/**
 * Resolves the path to index.html, trying multiple possible locations.
 * Enhanced with additional fallback paths for Vercel's serverless environment.
 */
function resolveIndexPath(): string | null {
	let __dirname: string;
	try {
		const __filename = fileURLToPath(import.meta.url);
		__dirname = dirname(__filename);
	} catch {
		__dirname = "";
	}

	const possiblePaths = [
		// Standard paths
		join(__dirname, "..", "web", "index.html"),
		join(process.cwd(), "web", "index.html"),
		join(process.cwd(), "..", "web", "index.html"),
		// Vercel-specific paths
		join(process.cwd(), "..", "..", "web", "index.html"),
		join("/var/task", "web", "index.html"), // AWS Lambda style
		join("/var/task", "..", "web", "index.html"),
		// Fallback to current directory structure
		"web/index.html",
		join(__dirname, "web", "index.html"),
	];

	console.log("[api/index] Attempting to resolve index.html path...");
	console.log("[api/index] __dirname:", __dirname);
	console.log("[api/index] process.cwd():", process.cwd());
	console.log("[api/index] Trying", possiblePaths.length, "possible paths");

	for (const path of possiblePaths) {
		console.log("[api/index] Checking path:", path);
		if (existsSync(path)) {
			console.log("[api/index] Found index.html at:", path);
			return path;
		}
	}

	console.error(
		"[api/index] Could not find index.html in any of the",
		possiblePaths.length,
		"attempted paths",
	);
	return null;
}

export default {
	/**
	 * Serves the web interface index page.
	 *
	 * @param req - The incoming request (for Vercel compatibility).
	 * @returns Response with HTML content or 404 error.
	 */
	fetch(req: Request): Response {
		try {
			console.log("[api/index] fetch() called, method:", req.method);
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

			console.log("[api/index] Reading index.html from:", indexPath);
			const html = readFileSync(indexPath, "utf-8");
			console.log("[api/index] Successfully read index.html, size:", html.length, "bytes");

			return new Response(html, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		} catch (error) {
			console.error("[api/index] Error serving index.html:", error);
			console.error("[api/index] Error stack:", error instanceof Error ? error.stack : "No stack");
			console.error("[api/index] Current working directory:", process.cwd());

			// Return a more user-friendly error without exposing internal paths
			return Response.json(
				{
					success: false,
					error: "Failed to load the web interface. Please check the server logs.",
				},
				{ status: HttpStatus.InternalServerError },
			);
		}
	},
};
