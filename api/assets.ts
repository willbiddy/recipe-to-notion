import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSET_ROUTES } from "./asset-routes";
import { normalizeAssetPath, resolveWebDir } from "./path-utils";

export default {
	/**
	 * Serves static assets based on the request path.
	 *
	 * @param req - The incoming request.
	 * @returns Response with asset content or 404 error.
	 */
	fetch(req: Request): Response {
		try {
			const pathname = normalizeAssetPath(req);
			const asset = ASSET_ROUTES[pathname];

			if (!asset) {
				return new Response("Not Found", {
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			const webDir = resolveWebDir();

			if (!webDir) {
				console.error("[api/assets] Could not find web directory in any expected location");
				console.error("[api/assets] Current working directory:", process.cwd());
				return new Response("Not Found", {
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			const filePath = join(webDir, asset.path);

			if (!existsSync(filePath)) {
				console.error("[api/assets] Asset file not found:", filePath);
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
			console.error("[api/assets] Error serving asset:", error);
			console.error("[api/assets] Error stack:", error instanceof Error ? error.stack : "No stack");
			return new Response("Not Found", {
				status: 404,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
	},
};
