/**
 * Storage abstraction for API key management and theme preferences.
 * Supports both localStorage (web) and chrome.storage.local (extension).
 */

import { Theme } from "@shared/constants";

/**
 * Storage key for API secret in both localStorage and chrome.storage.
 */
const STORAGE_KEY = "apiKey";

/**
 * Storage key for theme preference in both localStorage and chrome.storage.
 */
const THEME_STORAGE_KEY = "theme";

/** Storage interface for API keys and theme preferences. */
export type StorageAdapter = {
	getApiKey(): Promise<string | null>;
	saveApiKey(apiKey: string): Promise<void>;
	getTheme(): Promise<Theme | null>;
	saveTheme(theme: Theme | null): Promise<void>;
};

/** localStorage adapter for web interface. */
export class LocalStorageAdapter implements StorageAdapter {
	// biome-ignore lint/suspicious/useAwait: Async to match StorageAdapter interface
	async getApiKey(): Promise<string | null> {
		const apiKey = localStorage.getItem(STORAGE_KEY);
		return apiKey ? apiKey.trim() : null;
	}

	// biome-ignore lint/suspicious/useAwait: Async to match StorageAdapter interface
	async saveApiKey(apiKey: string): Promise<void> {
		localStorage.setItem(STORAGE_KEY, apiKey);
	}

	// biome-ignore lint/suspicious/useAwait: Async to match StorageAdapter interface
	async getTheme(): Promise<Theme | null> {
		const theme = localStorage.getItem(THEME_STORAGE_KEY);
		if (theme === Theme.Light || theme === Theme.Dark) {
			return theme;
		}
		return null;
	}

	// biome-ignore lint/suspicious/useAwait: Async to match StorageAdapter interface
	async saveTheme(theme: Theme | null): Promise<void> {
		if (theme === null) {
			localStorage.removeItem(THEME_STORAGE_KEY);
		} else {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		}
	}
}

/** chrome.storage.local adapter for extension. */
export class ChromeStorageAdapter implements StorageAdapter {
	async getApiKey(): Promise<string | null> {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		const apiKey = result[STORAGE_KEY];
		return typeof apiKey === "string" ? apiKey.trim() : null;
	}

	async saveApiKey(apiKey: string): Promise<void> {
		await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
	}

	async getTheme(): Promise<Theme | null> {
		const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
		const theme = result[THEME_STORAGE_KEY];
		if (theme === Theme.Light || theme === Theme.Dark) {
			return theme;
		}
		return null;
	}

	async saveTheme(theme: Theme | null): Promise<void> {
		if (theme === null) {
			await chrome.storage.local.remove(THEME_STORAGE_KEY);
		} else {
			await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
		}
	}
}

/** Creates a storage adapter based on the environment (Chrome extension or web). */
export function createStorageAdapter(): StorageAdapter {
	if (typeof chrome !== "undefined" && chrome.storage) {
		return new ChromeStorageAdapter();
	}
	return new LocalStorageAdapter();
}
