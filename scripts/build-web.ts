/**
 * Build script for web interface that ensures Solid.js JSX transform is applied.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";

// Build the web interface with Solid.js plugin
const result = await Bun.build({
	entrypoints: ["public/web.tsx"],
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
	await Bun.write("public/web.js", output);
	if (output.sourcemap) {
		await Bun.write("public/web.js.map", output.sourcemap);
	}
}
