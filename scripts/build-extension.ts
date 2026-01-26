/**
 * Build script for extension popup that ensures Solid.js JSX transform is applied.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";
import { handleBuildResult, validateBuildFiles, writeBuildOutput } from "./build-utils.js";

/**
 * Gets the server URL from environment variable or uses default.
 * Defaults to production Vercel URL if not set.
 */
const serverUrl = process.env.EXTENSION_SERVER_URL || "https://recipe-to-notion-xi.vercel.app";

// Build the extension popup with Solid.js plugin
const popupResult = await Bun.build({
	entrypoints: ["extension/popup.tsx"],
	target: "browser",
	minify: true,
	sourcemap: "external",
	define: {
		EXTENSION_SERVER_URL: JSON.stringify(serverUrl),
	},
	plugins: [
		SolidPlugin({
			generate: "dom",
			hydratable: false,
			debug: false,
		}),
	],
});

handleBuildResult(popupResult, "Popup");

// Write the popup output to the correct file
const popupOutput = popupResult.outputs[0];
await writeBuildOutput({
	output: popupOutput,
	targetPath: "extension/popup.js",
	name: "popup",
});

// Build the background service worker
const backgroundResult = await Bun.build({
	entrypoints: ["extension/background.ts"],
	target: "browser",
	minify: true,
	sourcemap: "external",
});

handleBuildResult(backgroundResult, "Background");

// Write the background output to the correct file
const backgroundOutput = backgroundResult.outputs[0];
await writeBuildOutput({
	output: backgroundOutput,
	targetPath: "extension/background.js",
	name: "background",
});

// Build the content script
const contentScriptResult = await Bun.build({
	entrypoints: ["extension/content-script.ts"],
	target: "browser",
	minify: true,
	sourcemap: "external",
});

handleBuildResult(contentScriptResult, "Content script");

// Write the content script output to the correct file
const contentScriptOutput = contentScriptResult.outputs[0];
await writeBuildOutput({
	output: contentScriptOutput,
	targetPath: "extension/content-script.js",
	name: "content script",
});

// Validate that all output files exist
validateBuildFiles({
	files: ["extension/popup.js", "extension/background.js", "extension/content-script.js"],
});
