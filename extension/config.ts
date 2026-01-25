/**
 * Configuration management for the browser extension.
 */

/**
 * Default server URL for the extension.
 * This should be updated to your Vercel deployment URL.
 */
const DEFAULT_SERVER_URL = "https://recipe-to-notion-xi.vercel.app";

/**
 * Gets the server URL for the extension.
 *
 * @returns The server URL (Vercel deployment).
 */
export function getServerUrl(): string {
	return DEFAULT_SERVER_URL;
}
