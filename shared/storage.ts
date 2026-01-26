/**
 * Storage abstraction for API key management.
 * Supports both localStorage (web) and chrome.storage.local (extension).
 */

/**
 * Storage key for API secret in both localStorage and chrome.storage.
 */
const STORAGE_KEY = "apiKey";

/**
 * Storage interface for API key operations.
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
