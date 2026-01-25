/**
 * Serves the web interface index page.
 * This allows the root path (/) to serve the HTML file from public/.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the correct path to public/index.html relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, "..", "public", "index.html");

export default {
	/**
	 * Serves the web interface index page.
	 *
	 * @returns Response with HTML content or 404 error.
	 */
	fetch(): Response {
		try {
			const html = readFileSync(indexPath, "utf-8");

			return new Response(html, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		} catch (error) {
			console.error("Error serving index.html:", error);
			console.error("Tried to read from:", indexPath);
			return new Response(
				`Not Found. Path: ${indexPath}, Error: ${error instanceof Error ? error.message : String(error)}`,
				{ status: 404 },
			);
		}
	},
};
