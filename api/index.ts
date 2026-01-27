/**
 * Serves the web interface index page.
 * This allows the root path (/) to serve the HTML file from public/.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consola } from "consola";
import { HttpStatus } from "../backend/server-shared/constants.js";
import { createErrorResponse } from "../backend/server-shared/errors.js";

// Initialize path variables with error handling
let __filename: string;
let __dirname: string;

try {
	__filename = fileURLToPath(import.meta.url);
	__dirname = dirname(__filename);
	console.log("[api/index] Module initialized successfully");
	console.log("[api/index] __dirname:", __dirname);
	console.log("[api/index] process.cwd():", process.cwd());
} catch (pathError) {
	console.error("[api/index] Failed to initialize path variables:", pathError);
	console.error(
		"[api/index] Error details:",
		pathError instanceof Error ? pathError.stack : String(pathError),
	);
	__filename = "";
	__dirname = "";
}

/**
 * Resolves the path to index.html, trying multiple possible locations.
 * Enhanced with additional fallback paths for Vercel's serverless environment.
 */
function resolveIndexPath(): string | null {
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

// Create handler with comprehensive error handling
let handler: { fetch: (req: Request) => Response };

try {
	handler = {
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
					console.error("[api/index] __dirname:", __dirname);
					consola.error("Could not find index.html in any expected location");
					consola.error("Current working directory:", process.cwd());
					consola.error("__dirname:", __dirname);
					return createErrorResponse(
						"Failed to load the web interface. Please check the server logs.",
						HttpStatus.InternalServerError,
						true,
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
				console.error(
					"[api/index] Error stack:",
					error instanceof Error ? error.stack : "No stack",
				);
				console.error("[api/index] Current working directory:", process.cwd());
				console.error("[api/index] __dirname:", __dirname);
				consola.error("Error serving index.html:", error);
				consola.error("Current working directory:", process.cwd());
				consola.error("__dirname:", __dirname);

				// Return a more user-friendly error without exposing internal paths
				return createErrorResponse(
					"Failed to load the web interface. Please check the server logs.",
					HttpStatus.InternalServerError,
					true,
				);
			}
		},
	};
} catch (moduleError) {
	console.error("[api/index] Failed to create handler:", moduleError);
	// Fallback handler if handler creation fails
	handler = {
		fetch(_req: Request): Response {
			console.error("[api/index] Using fallback handler - module initialization failed");
			return Response.json(
				{ success: false, error: "Module initialization failed" },
				{ status: 500 },
			);
		},
	};
}

export default handler;
