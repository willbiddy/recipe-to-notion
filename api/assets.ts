/**
 * Consolidated handler for all static assets.
 * Handles favicons, icons, manifest, CSS, and JS files.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, "..", "public");

/**
 * Asset route mappings to file paths and content types.
 */
const ASSET_ROUTES: Record<
	string,
	{
		path: string;
		contentType: string;
		isText?: boolean;
	}
> = {
	"/favicon.ico": {
		path: "favicon.png",
		contentType: "image/png",
	},
	"/favicon.png": {
		path: "favicon.png",
		contentType: "image/png",
	},
	"/favicon-16x16.png": {
		path: "favicon-16x16.png",
		contentType: "image/png",
	},
	"/favicon-32x32.png": {
		path: "favicon-32x32.png",
		contentType: "image/png",
	},
	"/favicon-white.png": {
		path: "favicon-white.png",
		contentType: "image/png",
	},
	"/favicon-16x16-white.png": {
		path: "favicon-16x16-white.png",
		contentType: "image/png",
	},
	"/favicon-32x32-white.png": {
		path: "favicon-32x32-white.png",
		contentType: "image/png",
	},
	"/apple-touch-icon.png": {
		path: "apple-touch-icon.png",
		contentType: "image/png",
	},
	"/fork-and-knife.png": {
		path: "fork-and-knife.png",
		contentType: "image/png",
	},
	"/manifest.json": {
		path: "manifest.json",
		contentType: "application/manifest+json; charset=utf-8",
		isText: true,
	},
	"/web.css": {
		path: "web.css",
		contentType: "text/css; charset=utf-8",
		isText: true,
	},
	"/web.js": {
		path: "web.js",
		contentType: "application/javascript; charset=utf-8",
		isText: true,
	},
	"/shared/api.js": {
		path: "shared/api.js",
		contentType: "application/javascript; charset=utf-8",
		isText: true,
	},
	"/shared/storage.js": {
		path: "shared/storage.js",
		contentType: "application/javascript; charset=utf-8",
		isText: true,
	},
	"/shared/ui.js": {
		path: "shared/ui.js",
		contentType: "application/javascript; charset=utf-8",
		isText: true,
	},
};

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

		// If this is a rewrite from Vercel, get the original path from headers
		const originalPath =
			req.headers.get("x-vercel-original-path") ||
			req.headers.get("x-invoke-path") ||
			url.searchParams.get("path");

		if (originalPath) {
			pathname = originalPath;
		} else if (pathname.startsWith("/api/")) {
			// Handle /api/web.js, /api/web.css, /api/favicon-*, etc.
			// Remove /api prefix to get the asset path
			const assetPath = pathname.replace("/api/", "/");
			// Check if it's a known asset route
			if (ASSET_ROUTES[assetPath]) {
				pathname = assetPath;
			} else if (pathname.startsWith("/api/assets")) {
				// Handle direct /api/assets/* routes
				pathname = pathname.replace("/api/assets", "") || "/";
			}
		}

		const asset = ASSET_ROUTES[pathname];

		if (!asset) {
			return new Response("Not Found", { status: 404 });
		}

		try {
			const filePath = join(publicDir, asset.path);
			const content = asset.isText ? readFileSync(filePath, "utf-8") : readFileSync(filePath);

			return new Response(content, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch (error) {
			console.error(`Error serving asset ${pathname}:`, error);
			return new Response("Not Found", { status: 404 });
		}
	},
};
