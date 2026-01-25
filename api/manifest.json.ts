/**
 * Serves the manifest.json file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestPath = join(__dirname, "..", "public", "manifest.json");

export default {
	/**
	 * Serves the manifest.json file.
	 *
	 * @returns Response with manifest content or 404 error.
	 */
	fetch(): Response {
		try {
			const manifest = readFileSync(manifestPath, "utf-8");
			return new Response(manifest, {
				headers: {
					"Content-Type": "application/manifest+json; charset=utf-8",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch {
			return new Response("Not Found", { status: 404 });
		}
	},
};
