import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves a file path by trying multiple possible locations.
 * Used for deployment compatibility across environments (local, Vercel, Lambda).
 *
 * @param possiblePaths - Array of paths to try, in order of preference
 * @param contextLabel - Label for error messages (e.g., "web directory")
 * @returns First existing path, or null if none exist
 */
export function resolveFilePath(possiblePaths: string[], contextLabel: string): string | null {
	for (const path of possiblePaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	console.error(
		`[path-utils] Could not find ${contextLabel} in any of the`,
		possiblePaths.length,
		"attempted paths",
	);
	return null;
}

/**
 * Gets __dirname equivalent for ES modules.
 */
function getDirname(): string {
	try {
		const __filename = fileURLToPath(import.meta.url);
		return dirname(__filename);
	} catch {
		return "";
	}
}

/**
 * Resolves the web directory path across different deployment environments.
 *
 * @returns Path to web directory, or null if not found
 */
export function resolveWebDir(): string | null {
	const __dirname = getDirname();

	const possiblePaths = [
		// Standard paths (local development and most deployments)
		join(__dirname, "..", "web"),
		join(process.cwd(), "web"),
		join(process.cwd(), "..", "web"),
		// Vercel-specific paths (serverless functions may be nested deeper)
		join(process.cwd(), "..", "..", "web"),
		join("/var/task", "web"), // AWS Lambda style
		join("/var/task", "..", "web"),
		// Fallback to current directory structure
		"web",
		join(__dirname, "web"),
	];

	return resolveFilePath(possiblePaths, "web directory");
}

/**
 * Resolves the index.html path across different deployment environments.
 *
 * @returns Path to index.html, or null if not found
 */
export function resolveIndexPath(): string | null {
	const __dirname = getDirname();

	const possiblePaths = [
		// Standard paths
		join(__dirname, "..", "web", "index.html"),
		join(process.cwd(), "web", "index.html"),
		join(process.cwd(), "..", "web", "index.html"),
		// Vercel-specific paths
		join(process.cwd(), "..", "..", "web", "index.html"),
		join("/var/task", "web", "index.html"), // AWS Lambda style
		join("/var/task", "..", "web", "index.html"),
		// Fallback to current directory structure
		"web/index.html",
		join(__dirname, "web", "index.html"),
	];

	return resolveFilePath(possiblePaths, "index.html");
}
