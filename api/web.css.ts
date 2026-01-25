/**
 * Serves the compiled web.css file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webCssPath = join(__dirname, "..", "public", "web.css");

export default {
	/**
	 * Serves the web.css file.
	 *
	 * @returns Response with CSS content or 404 error.
	 */
	fetch(): Response {
		try {
			const css = readFileSync(webCssPath, "utf-8");
			return new Response(css, {
				headers: {
					"Content-Type": "text/css; charset=utf-8",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch (error) {
			console.error("Error serving web.css:", error);
			return new Response("Not Found", { status: 404 });
		}
	},
};
