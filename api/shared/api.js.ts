/**
 * Serves the compiled shared/api.js file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiJsPath = join(__dirname, "..", "..", "public", "shared", "api.js");

export default {
	/**
	 * Serves the shared/api.js file.
	 *
	 * @returns Response with JavaScript content or 404 error.
	 */
	fetch(): Response {
		try {
			const js = readFileSync(apiJsPath, "utf-8");
			return new Response(js, {
				headers: {
					"Content-Type": "application/javascript; charset=utf-8",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch (error) {
			console.error("Error serving shared/api.js:", error);
			return new Response("Not Found", { status: 404 });
		}
	},
};
