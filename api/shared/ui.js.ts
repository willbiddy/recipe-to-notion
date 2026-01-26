/**
 * Serves the compiled shared/ui.js file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uiJsPath = join(__dirname, "..", "..", "public", "shared", "ui.js");

export default {
	/**
	 * Serves the shared/ui.js file.
	 *
	 * @returns Response with JavaScript content or 404 error.
	 */
	fetch(): Response {
		try {
			const js = readFileSync(uiJsPath, "utf-8");
			return new Response(js, {
				headers: {
					"Content-Type": "application/javascript; charset=utf-8",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch (error) {
			console.error("Error serving shared/ui.js:", error);
			return new Response("Not Found", { status: 404 });
		}
	},
};
