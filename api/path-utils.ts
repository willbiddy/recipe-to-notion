import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves a file or directory path by trying multiple possible locations.
 *
 * This utility is essential for deployment compatibility across different environments:
 * - **Local development**: Paths relative to source files work
 * - **Vercel serverless**: Working directory varies; needs multiple fallbacks
 * - **AWS Lambda**: Uses /var/task as base directory
 *
 * The function tries paths in order and returns the first one that exists.
 *
 * @param possiblePaths - Array of possible paths to try, in order of preference
 * @param contextLabel - Label for error logging (e.g., "web directory", "index.html")
 * @returns The first existing path, or null if none exist
 *
 * @example
 * ```ts
 * // Try to find a file in multiple locations
 * const configPath = resolveFilePath([
 *   join(__dirname, "config.json"),
 *   join(process.cwd(), "config.json"),
 *   "/etc/app/config.json"
 * ], "config.json");
 * ```
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
 *
 * In CommonJS, __dirname is automatically available. In ES modules,
 * we need to derive it from import.meta.url using fileURLToPath.
 *
 * @returns The directory containing the calling module, or empty string if unavailable
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
 * Resolves the path to the web directory, trying multiple possible locations.
 *
 * Vercel Deployment Strategy:
 * 1. Try paths relative to api/ directory (standard structure)
 * 2. Try paths relative to process.cwd() (varies in serverless)
 * 3. Try AWS Lambda-style paths (/var/task)
 * 4. Try fallback paths for edge cases
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
 * Resolves the path to index.html, trying multiple possible locations.
 *
 * Uses the same deployment strategy as resolveWebDir but targets
 * the specific index.html file.
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
