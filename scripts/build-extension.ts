/**
 * Build script for extension popup that ensures Solid.js JSX transform is applied.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";

// Build the extension popup with Solid.js plugin
const popupResult = await Bun.build({
	entrypoints: ["extension/popup.tsx"],
	target: "browser",
	minify: true,
	sourcemap: "external",
	plugins: [
		SolidPlugin({
			generate: "dom",
			hydratable: false,
			debug: false,
		}),
	],
});

if (!popupResult.success) {
	console.error("Popup build failed:", popupResult.logs);
	process.exit(1);
}

// Write the popup output to the correct file
const popupOutput = popupResult.outputs[0];
if (popupOutput) {
	await Bun.write("extension/popup.js", popupOutput);
	if (popupOutput.sourcemap) {
		await Bun.write("extension/popup.js.map", popupOutput.sourcemap);
	}
}

// Build the background service worker
const backgroundResult = await Bun.build({
	entrypoints: ["extension/background.ts"],
	target: "browser",
	minify: true,
	sourcemap: "external",
});

if (!backgroundResult.success) {
	console.error("Background build failed:", backgroundResult.logs);
	process.exit(1);
}

// Write the background output to the correct file
const backgroundOutput = backgroundResult.outputs[0];
if (backgroundOutput) {
	await Bun.write("extension/background.js", backgroundOutput);
	if (backgroundOutput.sourcemap) {
		await Bun.write("extension/background.js.map", backgroundOutput.sourcemap);
	}
}
