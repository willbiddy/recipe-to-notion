/**
 * Build script for extension popup that ensures Solid.js JSX transform is applied.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";

// Build the extension popup with Solid.js plugin
const result = await Bun.build({
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

if (!result.success) {
	console.error("Build failed:", result.logs);
	process.exit(1);
}

// Write the output to the correct file
const output = result.outputs[0];
if (output) {
	await Bun.write("extension/popup.js", output);
	if (output.sourcemap) {
		await Bun.write("extension/popup.js.map", output.sourcemap);
	}
}
