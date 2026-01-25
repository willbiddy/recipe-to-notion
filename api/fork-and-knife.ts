/**
 * Serves the fork-and-knife.png image.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const imagePath = join(__dirname, "..", "public", "fork-and-knife.png");

export default {
	/**
	 * Serves the fork-and-knife.png image.
	 *
	 * @returns Response with image content or 404 error.
	 */
	fetch(): Response {
		try {
			const image = readFileSync(imagePath);
			return new Response(image, {
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
