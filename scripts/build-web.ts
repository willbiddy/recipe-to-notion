/**
 * Build script for web interface that ensures Solid.js JSX transform is applied.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";
import { handleBuildResult, validateBuildFiles, writeBuildOutput } from "./build-utils.js";

// Build the web interface with Solid.js plugin
const result = await Bun.build({
	entrypoints: ["web/web.tsx"],
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

handleBuildResult(result, "Web");

// Write the output to the correct file
const output = result.outputs[0];
await writeBuildOutput({
	output,
	targetPath: "web/web.js",
	name: "web",
});

// Validate that output files exist
validateBuildFiles({ files: ["web/web.js"] });
