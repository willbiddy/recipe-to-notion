/**
 * Build script for API functions - bundles TypeScript with Bun
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "bun";

const apiDir = "api";
const outDir = "dist/api";

// Ensure output directory exists
if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true });
}

// Get all TypeScript files in api directory (excluding .d.ts)
const apiFiles = readdirSync(apiDir)
	.filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
	.map((f) => join(apiDir, f));

console.log("Building API functions...");

for (const file of apiFiles) {
	const outputFile = file.replace(".ts", ".js").replace(apiDir, outDir);
	const outputDir = outputFile.split("/").slice(0, -1).join("/");

	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	console.log(`  Bundling ${file} -> ${outputFile}`);

	try {
		await build({
			entrypoints: [file],
			outdir: outputDir,
			target: "node",
			format: "esm",
			minify: true,
			external: ["@anthropic-ai/sdk", "@notionhq/client"], // Keep as external deps
		});
		console.log(`  ✓ Built ${file}`);
	} catch (error) {
		console.error(`  ✗ Failed to build ${file}:`, error);
		process.exit(1);
	}
}

console.log("\n✅ API build complete!");
