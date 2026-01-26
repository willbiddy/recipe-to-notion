/**
 * Build script for extension popup that ensures Solid.js JSX transform is applied.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";
import { handleBuildResult, validateBuildFiles, writeBuildOutput } from "./build-utils.js";

/**
 * Server URL for the extension.
 *
 * Gets the server URL from environment variable or uses default.
 * Defaults to production Vercel URL if not set.
 */
const serverUrl = process.env.EXTENSION_SERVER_URL || "https://recipe-to-notion-xi.vercel.app";

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

const popupOutput = popupResult.outputs[0];
await writeBuildOutput({
	output: popupOutput,
	targetPath: "extension/popup.js",
	name: "popup",
});

const backgroundResult = await Bun.build({
	entrypoints: ["extension/background.ts"],
	target: "browser",
	minify: true,
	sourcemap: "external",
});

handleBuildResult(backgroundResult, "Background");

const backgroundOutput = backgroundResult.outputs[0];
await writeBuildOutput({
	output: backgroundOutput,
	targetPath: "extension/background.js",
	name: "background",
});

const contentScriptResult = await Bun.build({
	entrypoints: ["extension/content-script.ts"],
	target: "browser",
	minify: true,
	sourcemap: "external",
});

handleBuildResult(contentScriptResult, "Content script");

const contentScriptOutput = contentScriptResult.outputs[0];
await writeBuildOutput({
	output: contentScriptOutput,
	targetPath: "extension/content-script.js",
	name: "content script",
});

validateBuildFiles({
	files: ["extension/popup.js", "extension/background.js", "extension/content-script.js"],
});
