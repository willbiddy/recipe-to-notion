/**
 * Serves the Apple touch icon file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconPath = join(__dirname, "..", "public", "apple-touch-icon.png");

export default {
	/**
	 * Serves the Apple touch icon file.
	 *
	 * @returns Response with icon image or 404 error.
	 */
	fetch(): Response {
		try {
			const icon = readFileSync(iconPath);
			return new Response(icon, {
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
