/**
 * Configuration management for the browser extension.
 */

const SERVER_URL = "http://localhost:3000";

/**
 * Gets the server URL (always localhost:3000).
 * @returns The server URL
 */
export function getServerUrl(): string {
	return SERVER_URL;
}
