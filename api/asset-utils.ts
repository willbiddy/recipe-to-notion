import { ASSET_ROUTES } from "./asset-routes.js";

/**
 * Normalizes the request pathname for asset routing.
 *
 * Handles Vercel-specific headers and API path prefixes to determine
 * the correct asset path from the request.
 *
 * @param request - The incoming HTTP request.
 * @returns The normalized pathname for asset lookup.
 */
export function normalizeAssetPath(request: Request): string {
	const url = new URL(request.url);
	let pathname = url.pathname;

	const originalPath =
		request.headers.get("x-vercel-original-path") ||
		request.headers.get("x-invoke-path") ||
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

	return pathname;
}
