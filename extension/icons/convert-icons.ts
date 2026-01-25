#!/usr/bin/env bun
/**
 * Converts SVG icons to PNG at required sizes.
 * Requires: bun install sharp
 */

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const sizes = [16, 48, 128] as const;
const iconFile = "icon.svg";

async function convertIcon() {
	const svgPath = join(import.meta.dir, iconFile);
	
	try {
		const svgBuffer = await readFile(svgPath);
		
		for (const size of sizes) {
			const outputPath = join(import.meta.dir, `icon${size}.png`);
			
			await sharp(svgBuffer)
				.resize(size, size, {
					fit: "contain",
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
				.png()
				.toFile(outputPath);
			
			console.log(`✓ Created icon${size}.png (${size}x${size})`);
		}
		
		console.log("\n✓ All icons created successfully!");
	} catch (error) {
		if (error instanceof Error && error.message.includes("sharp")) {
			console.error(
				"Error: sharp package not found. Install it with:",
				"\n  bun add -d sharp",
			);
		} else {
			console.error("Error converting icons:", error);
		}
		process.exit(1);
	}
}

convertIcon();
