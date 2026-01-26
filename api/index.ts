/**
 * Serves the web interface index page.
 * This allows the root path (/) to serve the HTML file from public/.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consola } from "consola";
import { HttpStatus } from "../backend/server-shared/constants.js";
import { createErrorResponse } from "../backend/server-shared/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, "..", "web", "index.html");

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
			consola.error("Error serving index.html:", error);
			consola.error("Tried to read from:", indexPath);

			const errorMessage = error instanceof Error ? error.message : String(error);
			return createErrorResponse(
				`Not Found. Path: ${indexPath}, Error: ${errorMessage}`,
				HttpStatus.NotFound,
				false,
			);
		}
	},
};
