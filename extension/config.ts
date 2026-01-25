/**
 * Configuration management for the browser extension.
 */

const SERVER_URL = "https://recipe-to-notion-xi.vercel.app";

/**
 * Gets the server URL.
 * @returns The server URL (Vercel deployment)
 */
export function getServerUrl(): string {
	return SERVER_URL;
}
