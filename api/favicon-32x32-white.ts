/**
 * Serves the 32x32 favicon file (white version for dark mode).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const faviconPath = join(__dirname, "..", "public", "favicon-32x32-white.png");

export default {
	/**
	 * Serves the 32x32 white favicon file for dark mode.
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
