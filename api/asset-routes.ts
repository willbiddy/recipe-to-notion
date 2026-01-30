/** Content types for static assets. */
export enum ContentType {
	Png = "image/png",
	ManifestJson = "application/manifest+json; charset=utf-8",
	Css = "text/css; charset=utf-8",
	JavaScript = "application/javascript; charset=utf-8",
}

/** Asset route configuration. */
export type AssetRoute = {
	path: string;
	contentType: ContentType;
	isText?: boolean;
};

/**
 * Asset route mappings for web interface static files.
 * All paths are relative to dist/web/ directory.
 */
export const ASSET_ROUTES: Record<string, AssetRoute> = {
	// Favicons
	"/favicon.ico": { path: "favicon.png", contentType: ContentType.Png },
	"/favicon.png": { path: "favicon.png", contentType: ContentType.Png },
	"/favicon-16x16.png": { path: "favicon-16x16.png", contentType: ContentType.Png },
	"/favicon-32x32.png": { path: "favicon-32x32.png", contentType: ContentType.Png },
	"/favicon-white.png": { path: "favicon-white.png", contentType: ContentType.Png },
	"/favicon-16x16-white.png": { path: "favicon-16x16-white.png", contentType: ContentType.Png },
	"/favicon-32x32-white.png": { path: "favicon-32x32-white.png", contentType: ContentType.Png },
	"/apple-touch-icon.png": { path: "apple-touch-icon.png", contentType: ContentType.Png },
	"/fork-and-knife.png": { path: "fork-and-knife.png", contentType: ContentType.Png },

	// Text assets
	"/manifest.json": { path: "manifest.json", contentType: ContentType.ManifestJson, isText: true },
	"/web.css": { path: "web.css", contentType: ContentType.Css, isText: true },
	"/web.js": { path: "web.js", contentType: ContentType.JavaScript, isText: true },
	"/shared/api.js": { path: "shared/api.js", contentType: ContentType.JavaScript, isText: true },
	"/shared/storage.js": {
		path: "shared/storage.js",
		contentType: ContentType.JavaScript,
		isText: true,
	},
};
