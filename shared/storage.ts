/**
 * Storage abstraction for API key management and theme preferences.
 * Supports both localStorage (web) and chrome.storage.local (extension).
 */

import { Theme } from "./constants";

/**
 * Storage key for API secret in both localStorage and chrome.storage.
 */
const STORAGE_KEY = "apiKey";

/**
 * Storage key for theme preference in both localStorage and chrome.storage.
 */
const THEME_STORAGE_KEY = "theme";

/**
 * Storage interface for API key operations and theme preferences.
 *
 * Methods are async to support both synchronous (localStorage) and asynchronous
 * (chrome.storage.local) storage backends through a unified interface.
 */
export type StorageAdapter = {
	/**
	 * Retrieves the stored API key.
	 *
	 * @returns The API key string if found, or null if not set.
	 */
	getApiKey(): Promise<string | null>;
	/**
	 * Saves the API key to storage.
	 *
	 * @param apiKey - The API key to store.
	 */
	saveApiKey(apiKey: string): Promise<void>;
	/**
	 * Retrieves the stored theme preference.
	 *
	 * @returns The Theme value if found, or null to use system preference.
	 */
	getTheme(): Promise<Theme | null>;
	/**
	 * Saves the theme preference to storage.
	 *
	 * @param theme - The theme to store, or null to use system preference.
	 */
	saveTheme(theme: Theme | null): Promise<void>;
};

/**
 * localStorage adapter for web interface.
 *
 * Methods are async to match the StorageAdapter interface, even though
 * localStorage operations are synchronous. This allows a unified interface
 * for both web (localStorage) and extension (chrome.storage.local) contexts.
 */
export class LocalStorageAdapter implements StorageAdapter {
	/**
	 * Retrieves the API key from localStorage.
	 *
	 * @returns The API key string if found, or null if not set.
	 */
	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async getApiKey(): Promise<string | null> {
		const apiKey = localStorage.getItem(STORAGE_KEY);
		return apiKey ? apiKey.trim() : null;
	}

	/**
	 * Saves the API key to localStorage.
	 *
	 * @param apiKey - The API key to store.
	 */
	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async saveApiKey(apiKey: string): Promise<void> {
		localStorage.setItem(STORAGE_KEY, apiKey);
	}

	/**
	 * Retrieves the theme preference from localStorage.
	 *
	 * @returns The Theme value if found, or null to use system preference.
	 */
	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async getTheme(): Promise<Theme | null> {
		const theme = localStorage.getItem(THEME_STORAGE_KEY);
		if (theme === Theme.Light || theme === Theme.Dark) {
			return theme;
		}
		return null;
	}

	/**
	 * Saves the theme preference to localStorage.
	 *
	 * @param theme - The theme to store, or null to use system preference.
	 */
	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async saveTheme(theme: Theme | null): Promise<void> {
		if (theme === null) {
			localStorage.removeItem(THEME_STORAGE_KEY);
		} else {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		}
	}
}

/**
 * chrome.storage.local adapter for extension.
 *
 * Uses Chrome's storage API for persistent storage in browser extensions.
 * All operations are asynchronous as required by the Chrome storage API.
 */
export class ChromeStorageAdapter implements StorageAdapter {
	/**
	 * Retrieves the API key from chrome.storage.local.
	 *
	 * @returns The API key string if found, or null if not set.
	 */
	async getApiKey(): Promise<string | null> {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		const apiKey = result[STORAGE_KEY];
		return typeof apiKey === "string" ? apiKey.trim() : null;
	}

	/**
	 * Saves the API key to chrome.storage.local.
	 *
	 * @param apiKey - The API key to store.
	 */
	async saveApiKey(apiKey: string): Promise<void> {
		await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
	}

	/**
	 * Retrieves the theme preference from chrome.storage.local.
	 *
	 * @returns The Theme value if found, or null to use system preference.
	 */
	async getTheme(): Promise<Theme | null> {
		const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
		const theme = result[THEME_STORAGE_KEY];
		if (theme === Theme.Light || theme === Theme.Dark) {
			return theme;
		}
		return null;
	}

	/**
	 * Saves the theme preference to chrome.storage.local.
	 *
	 * @param theme - The theme to store, or null to use system preference.
	 */
	async saveTheme(theme: Theme | null): Promise<void> {
		if (theme === null) {
			await chrome.storage.local.remove(THEME_STORAGE_KEY);
		} else {
			await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
		}
	}
}

/**
 * Creates a storage adapter based on the environment.
 *
 * Returns ChromeStorageAdapter if running in a Chrome extension context,
 * otherwise returns LocalStorageAdapter for web interface.
 *
 * @returns Storage adapter appropriate for the current environment.
 */
export function createStorageAdapter(): StorageAdapter {
	if (typeof chrome !== "undefined" && chrome.storage) {
		return new ChromeStorageAdapter();
	}
	return new LocalStorageAdapter();
}
