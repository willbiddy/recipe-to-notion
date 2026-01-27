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

// Initialize path variables with error handling
let __filename: string;
let __dirname: string;

try {
	__filename = fileURLToPath(import.meta.url);
	__dirname = dirname(__filename);
	console.log("[api/assets] Module initialized successfully");
	console.log("[api/assets] __dirname:", __dirname);
	console.log("[api/assets] process.cwd():", process.cwd());
} catch (pathError) {
	console.error("[api/assets] Failed to initialize path variables:", pathError);
	console.error(
		"[api/assets] Error details:",
		pathError instanceof Error ? pathError.stack : String(pathError),
	);
	__filename = "";
	__dirname = "";
}

/**
 * Resolves the path to the web directory, trying multiple possible locations.
 * Enhanced with additional fallback paths for Vercel's serverless environment.
 */
function resolveWebDir(): string | null {
	const possiblePaths = [
		// Standard paths
		join(__dirname, "..", "web"),
		join(process.cwd(), "web"),
		join(process.cwd(), "..", "web"),
		// Vercel-specific paths
		join(process.cwd(), "..", "..", "web"),
		join("/var/task", "web"), // AWS Lambda style
		join("/var/task", "..", "web"),
		// Fallback to current directory structure
		"web",
		join(__dirname, "web"),
	];

	console.log("[api/assets] Attempting to resolve web directory path...");
	console.log("[api/assets] Trying", possiblePaths.length, "possible paths");

	for (const path of possiblePaths) {
		console.log("[api/assets] Checking path:", path);
		if (existsSync(path)) {
			console.log("[api/assets] Found web directory at:", path);
			return path;
		}
	}

	console.error(
		"[api/assets] Could not find web directory in any of the",
		possiblePaths.length,
		"attempted paths",
	);
	return null;
}

// Create handler with comprehensive error handling
let handler: { fetch: (req: Request) => Response };

try {
	handler = {
		/**
		 * Serves static assets based on the request path.
		 *
		 * @param req - The incoming request.
		 * @returns Response with asset content or 404 error.
		 */
		fetch(req: Request): Response {
			try {
				console.log("[api/assets] fetch() called, method:", req.method, "url:", req.url);
				const pathname = normalizeAssetPath(req);
				console.log("[api/assets] Normalized pathname:", pathname);
				const asset = ASSET_ROUTES[pathname];

				if (!asset) {
					console.log("[api/assets] No asset route found for:", pathname);
					return new Response("Not Found", {
						status: 404,
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					});
				}

				console.log("[api/assets] Asset route found:", asset.path);
				const webDir = resolveWebDir();

				if (!webDir) {
					console.error("[api/assets] Could not find web directory in any expected location");
					console.error("[api/assets] Current working directory:", process.cwd());
					console.error("[api/assets] __dirname:", __dirname);
					consola.error("Could not find web directory in any expected location");
					consola.error("Current working directory:", process.cwd());
					consola.error("__dirname:", __dirname);
					return new Response("Not Found", {
						status: 404,
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					});
				}

				const filePath = join(webDir, asset.path);
				console.log("[api/assets] Resolved file path:", filePath);

				if (!existsSync(filePath)) {
					console.error("[api/assets] Asset file not found:", filePath);
					consola.error(`Asset file not found: ${filePath}`);
					return new Response("Not Found", {
						status: 404,
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					});
				}

				console.log("[api/assets] Reading asset file:", filePath);
				const content = asset.isText ? readFileSync(filePath, "utf-8") : readFileSync(filePath);
				console.log("[api/assets] Successfully read asset, size:", content.length, "bytes");

				return new Response(content, {
					headers: {
						"Content-Type": asset.contentType,
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			} catch (error) {
				console.error("[api/assets] Error serving asset:", error);
				console.error(
					"[api/assets] Error stack:",
					error instanceof Error ? error.stack : "No stack",
				);
				consola.error(`Error serving asset:`, error);
				return new Response("Not Found", {
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}
		},
	};
} catch (moduleError) {
	console.error("[api/assets] Failed to create handler:", moduleError);
	// Fallback handler if handler creation fails
	handler = {
		fetch(_req: Request): Response {
			console.error("[api/assets] Using fallback handler - module initialization failed");
			return Response.json(
				{ success: false, error: "Module initialization failed" },
				{ status: 500 },
			);
		},
	};
}

export default handler;
