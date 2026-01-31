/**
 * Unified build script for extension and web interfaces.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SolidPlugin } from "@dschz/bun-plugin-solid";
import { $ } from "bun";
import { handleBuildResult } from "./build-utils";

const target = process.argv[2] || "all";
const isDev = process.argv.includes("--dev");

// Ensure dist directory exists
const distDir = join(process.cwd(), "dist");
if (!existsSync(distDir)) {
	mkdirSync(distDir, { recursive: true });
}

async function buildExtension(): Promise<void> {
	console.log("🔨 Building extension...");
	const serverUrl = process.env.EXTENSION_SERVER_URL || "https://recipe-to-notion-xi.vercel.app";

	const popupResult = await Bun.build({
		entrypoints: ["extension/popup.tsx"],
		outdir: "dist/extension",
		target: "browser",
		minify: !isDev,
		sourcemap: isDev ? "inline" : "external",
		define: { EXTENSION_SERVER_URL: JSON.stringify(serverUrl) },
		plugins: [SolidPlugin({ generate: "dom", hydratable: false })],
	});
	handleBuildResult(popupResult, "Extension popup");

	const backgroundResult = await Bun.build({
		entrypoints: ["extension/background.ts"],
		outdir: "dist/extension",
		target: "browser",
		minify: !isDev,
		sourcemap: isDev ? "inline" : "external",
	});
	handleBuildResult(backgroundResult, "Extension background");

	const contentResult = await Bun.build({
		entrypoints: ["extension/content-script.ts"],
		outdir: "dist/extension",
		target: "browser",
		minify: !isDev,
		sourcemap: isDev ? "inline" : "external",
	});
	handleBuildResult(contentResult, "Extension content script");

	await $`bunx tailwindcss -i extension/input.css -o dist/extension/styles.css ${isDev ? "" : "--minify"}`.quiet();
	await $`cp extension/popup.html dist/extension/`.quiet();
	await $`cp extension/manifest.json dist/extension/`.quiet();
	await $`cp -r extension/icons dist/extension/ 2>/dev/null || true`.quiet();

	console.log("✅ Extension build complete");
}

async function buildWeb(): Promise<void> {
	console.log("🔨 Building web interface...");

	const webResult = await Bun.build({
		entrypoints: ["web/web.tsx"],
		outdir: "dist/web",
		target: "browser",
		minify: !isDev,
		sourcemap: isDev ? "inline" : "external",
		plugins: [SolidPlugin({ generate: "dom", hydratable: false })],
	});
	handleBuildResult(webResult, "Web interface");

	await $`bunx tailwindcss -i web/input.css -o dist/web/web.css ${isDev ? "" : "--minify"}`.quiet();
	await $`cp web/index.html dist/web/`.quiet();
	await $`cp web/manifest.json dist/web/`.quiet();
	await $`cp web/favicon*.png dist/web/ 2>/dev/null || true`.quiet();
	await $`cp web/apple-touch-icon.png dist/web/ 2>/dev/null || true`.quiet();
	await $`cp web/fork-and-knife.png dist/web/ 2>/dev/null || true`.quiet();

	console.log("✅ Web build complete");
}

async function main(): Promise<void> {
	console.log(`📦 Building target: ${target}${isDev ? " (dev mode)" : ""}\n`);
	try {
		if (target === "all" || target === "extension") await buildExtension();
		if (target === "all" || target === "web") await buildWeb();
		console.log("\n🎉 Build complete!");
	} catch (error) {
		console.error("\n❌ Build failed:", error);
		process.exit(1);
	}
}

await main();
