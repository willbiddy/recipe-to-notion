/**
 * Build script for API functions - bundles TypeScript with Bun
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { build } from "bun";

const apiDir = "api";
const outDir = "api/dist";

// Ensure output directory exists
if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true });
}

// Get all TypeScript files in api directory
const getTsFiles = (dir: string): string[] => {
	const files: string[] = [];
	const items = readdirSync(dir);

	for (const item of items) {
		const fullPath = join(dir, item);
		const stat = statSync(fullPath);

		if (stat.isDirectory() && item !== "dist" && item !== "__pycache__") {
			files.push(...getTsFiles(fullPath));
		} else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
			files.push(fullPath);
		}
	}

	return files;
};

const apiFiles = getTsFiles(apiDir);

console.log(`Building ${apiFiles.length} API function(s)...`);

for (const file of apiFiles) {
	const relativePath = file.replace(apiDir + "/", "");
	const outputFile = join(outDir, relativePath.replace(".ts", ".js"));
	const outputDir = outputFile.split("/").slice(0, -1).join("/");

	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	console.log(`  → ${relativePath}`);

	try {
		const result = await build({
			entrypoints: [file],
			outdir: outputDir,
			target: "node",
			format: "esm",
			minify: true,
			splitting: false,
		});

		if (!result.success) {
			console.error(`    ✗ Failed:`, result.logs);
			process.exit(1);
		}
	} catch (error) {
		console.error(`    ✗ Error:`, error);
		process.exit(1);
	}
}

console.log("\n✅ API functions built to api/dist/");
