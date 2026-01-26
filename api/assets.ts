/**
 * Consolidated handler for all static assets.
 * Handles favicons, icons, manifest, CSS, and JS files.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consola } from "consola";
import { ASSET_ROUTES } from "./asset-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webDir = join(__dirname, "..", "web");

export default {
	/**
	 * Serves static assets based on the request path.
	 *
	 * @param req - The incoming request.
	 * @returns Response with asset content or 404 error.
	 */
	fetch(req: Request): Response {
		const url = new URL(req.url);
		let pathname = url.pathname;

		const originalPath =
			req.headers.get("x-vercel-original-path") ||
			req.headers.get("x-invoke-path") ||
			url.searchParams.get("path");

		if (originalPath) {
			pathname = originalPath;
		} else if (pathname.startsWith("/api/")) {
			const assetPath = pathname.replace("/api/", "/");
			if (ASSET_ROUTES[assetPath]) {
				pathname = assetPath;
			} else if (pathname.startsWith("/api/assets")) {
				pathname = pathname.replace("/api/assets", "") || "/";
			}
		}

		const asset = ASSET_ROUTES[pathname];

		if (!asset) {
			return new Response("Not Found", {
				status: 404,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}

		try {
			const filePath = join(webDir, asset.path);
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
