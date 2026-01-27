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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolves the path to index.html, trying multiple possible locations.
 */
function resolveIndexPath(): string | null {
	const possiblePaths = [
		join(__dirname, "..", "web", "index.html"),
		join(process.cwd(), "web", "index.html"),
		join(process.cwd(), "..", "web", "index.html"),
	];

	for (const path of possiblePaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

export default {
	/**
	 * Serves the web interface index page.
	 *
	 * @returns Response with HTML content or 404 error.
	 */
	fetch(): Response {
		try {
			const indexPath = resolveIndexPath();

			if (!indexPath) {
				console.error("Could not find index.html in any expected location");
				console.error("Current working directory:", process.cwd());
				console.error("__dirname:", __dirname);
				consola.error("Could not find index.html in any expected location");
				consola.error("Current working directory:", process.cwd());
				consola.error("__dirname:", __dirname);
				return createErrorResponse(
					"Failed to load the web interface. Please check the server logs.",
					HttpStatus.InternalServerError,
					true,
				);
			}

			const html = readFileSync(indexPath, "utf-8");

			return new Response(html, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		} catch (error) {
			console.error("Error serving index.html:", error);
			console.error("Current working directory:", process.cwd());
			console.error("__dirname:", __dirname);
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
