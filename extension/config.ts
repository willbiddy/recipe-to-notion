/**
 * Configuration management for the browser extension.
 */

/**
 * Build-time constant for server URL, injected by build script.
 * @internal
 */
declare const EXTENSION_SERVER_URL: string | undefined;

/**
 * Server URL for the extension.
 * Injected at build time via environment variable EXTENSION_SERVER_URL.
 * Falls back to localhost for development if not set.
 */
const SERVER_URL =
	typeof EXTENSION_SERVER_URL !== "undefined" && EXTENSION_SERVER_URL
		? EXTENSION_SERVER_URL
		: "http://localhost:3000";

/**
 * Gets the server URL for the extension.
 *
 * @returns The server URL (from environment variable or localhost fallback).
 */
export function getServerUrl(): string {
	return SERVER_URL;
}
