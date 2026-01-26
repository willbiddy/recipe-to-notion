/**
 * Serves the main favicon file (white version for dark mode).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const faviconPath = join(__dirname, "..", "public", "favicon-white.png");

export default {
	/**
	 * Serves the white favicon file for dark mode.
	 *
	 * @returns Response with favicon image or 404 error.
	 */
	fetch(): Response {
		try {
			const favicon = readFileSync(faviconPath);
			return new Response(favicon, {
				headers: {
					"Content-Type": "image/png",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch {
			return new Response("Not Found", { status: 404 });
		}
	},
};
