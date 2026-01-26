/**
 * Consolidated handler for all static assets.
 * Handles favicons, icons, manifest, CSS, and JS files.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consola } from "consola";
import { ASSET_ROUTES } from "./asset-routes.js";
import { normalizeAssetPath } from "./asset-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolves the path to the web directory, trying multiple possible locations.
 */
function resolveWebDir(): string | null {
	const possiblePaths = [
		join(__dirname, "..", "web"),
		join(process.cwd(), "web"),
		join(process.cwd(), "..", "web"),
	];

	for (const path of possiblePaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

export default {
	/**
	 * Serves static assets based on the request path.
	 *
	 * @param req - The incoming request.
	 * @returns Response with asset content or 404 error.
	 */
	fetch(req: Request): Response {
		const pathname = normalizeAssetPath(req);
		const asset = ASSET_ROUTES[pathname];

		if (!asset) {
			return new Response("Not Found", {
				status: 404,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}

		try {
			const webDir = resolveWebDir();

			if (!webDir) {
				consola.error("Could not find web directory in any expected location");
				consola.error("Current working directory:", process.cwd());
				consola.error("__dirname:", __dirname);
				return new Response("Not Found", {
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			const filePath = join(webDir, asset.path);

			if (!existsSync(filePath)) {
				consola.error(`Asset file not found: ${filePath}`);
				return new Response("Not Found", {
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			const content = asset.isText ? readFileSync(filePath, "utf-8") : readFileSync(filePath);

			return new Response(content, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch (error) {
			consola.error(`Error serving asset ${pathname}:`, error);
			return new Response("Not Found", {
				status: 404,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
	},
};
