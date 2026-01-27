/**
 * Watch script that rebuilds on file changes.
 * Supports watching extension, web, or both.
 */

import { $ } from "bun";
import chokidar from "chokidar";

const target = process.argv[2] || "all";

const buildExtension = async () => {
	console.log("🔨 Building extension...");
	try {
		await $`bun scripts/build-extension.ts`.quiet();
		await $`bunx tailwindcss -i extension/input.css -o extension/styles.css --minify`.quiet();
		console.log("✅ Extension build complete");
	} catch (error) {
		console.error("❌ Extension build failed:", error);
	}
};

const buildWeb = async () => {
	console.log("🔨 Building web...");
	try {
		await $`bun scripts/build-web.ts`.quiet();
		await $`bunx tailwindcss -i web/input.css -o web/web.css --minify`.quiet();
		console.log("✅ Web build complete");
	} catch (error) {
		console.error("❌ Web build failed:", error);
	}
};

// Initial build
if (target === "extension" || target === "all") {
	await buildExtension();
}
if (target === "web" || target === "all") {
	await buildWeb();
}

// Watch patterns
const extensionPatterns = ["extension/**/*.{ts,tsx,css}", "shared/**/*.{ts,tsx}"];

const webPatterns = ["web/**/*.{ts,tsx,css}", "shared/**/*.{ts,tsx}"];

const patterns =
	target === "extension"
		? extensionPatterns
		: target === "web"
			? webPatterns
			: [...new Set([...extensionPatterns, ...webPatterns])];

console.log(`👀 Watching: ${patterns.join(", ")}`);
console.log(`📦 Target: ${target}`);
console.log(
	`\n💡 Tip: This script only rebuilds files. To run the development server, open another terminal and run: bun run server\n`,
);

// Debounce function
let buildTimeout: Timer | null = null;
const DEBOUNCE_MS = 500;

const scheduleBuild = (type: "extension" | "web" | "all") => {
	if (buildTimeout) {
		clearTimeout(buildTimeout);
	}
	buildTimeout = setTimeout(async () => {
		if (type === "extension" || type === "all") {
			await buildExtension();
		}
		if (type === "web" || type === "all") {
			await buildWeb();
		}
	}, DEBOUNCE_MS);
};

// Create watcher
const watcher = chokidar.watch(patterns, {
	ignored: /(^|[/\\])\../, // ignore dotfiles
	persistent: true,
	ignoreInitial: true,
});

watcher.on("change", (path) => {
	const isExtension =
		path.startsWith("extension/") ||
		(path.startsWith("shared/") && (target === "extension" || target === "all"));
	const isWeb =
		path.startsWith("web/") ||
		(path.startsWith("shared/") && (target === "web" || target === "all"));

	if (isExtension && isWeb) {
		scheduleBuild("all");
	} else if (isExtension) {
		scheduleBuild("extension");
	} else if (isWeb) {
		scheduleBuild("web");
	}
});

watcher.on("error", (error) => {
	console.error("❌ Watcher error:", error);
});

console.log("✨ Watch mode active. Press Ctrl+C to stop.");

// Handle shutdown
process.on("SIGINT", async () => {
	console.log("\n👋 Stopping watch mode...");
	await watcher.close();
	process.exit(0);
});
