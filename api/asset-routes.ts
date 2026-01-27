/**
 * Asset route configuration type.
 */
export type AssetRoute = {
	/**
	 * File path relative to web directory.
	 */
	path: string;
	/**
	 * Content-Type header value.
	 */
	contentType: string;
	/**
	 * Whether the file should be read as text (UTF-8).
	 */
	isText?: boolean;
};

/**
 * Asset route mappings to file paths and content types.
 */
export const ASSET_ROUTES: Record<string, AssetRoute> = {
	"/favicon.ico": {
		path: "favicon.png",
		contentType: "image/png",
	},
	"/favicon.png": {
		path: "favicon.png",
		contentType: "image/png",
	},
	"/favicon": {
		path: "favicon.png",
		contentType: "image/png",
	},
	"/favicon-16x16.png": {
		path: "favicon-16x16.png",
		contentType: "image/png",
	},
	"/favicon-16x16": {
		path: "favicon-16x16.png",
		contentType: "image/png",
	},
	"/favicon-32x32.png": {
		path: "favicon-32x32.png",
		contentType: "image/png",
	},
	"/favicon-32x32": {
		path: "favicon-32x32.png",
		contentType: "image/png",
	},
	"/favicon-white.png": {
		path: "favicon-white.png",
		contentType: "image/png",
	},
	"/favicon-white": {
		path: "favicon-white.png",
		contentType: "image/png",
	},
	"/favicon-16x16-white.png": {
		path: "favicon-16x16-white.png",
		contentType: "image/png",
	},
	"/favicon-16x16-white": {
		path: "favicon-16x16-white.png",
		contentType: "image/png",
	},
	"/favicon-32x32-white.png": {
		path: "favicon-32x32-white.png",
		contentType: "image/png",
	},
	"/favicon-32x32-white": {
		path: "favicon-32x32-white.png",
		contentType: "image/png",
	},
	"/apple-touch-icon.png": {
		path: "apple-touch-icon.png",
		contentType: "image/png",
	},
	"/apple-touch-icon": {
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
};
