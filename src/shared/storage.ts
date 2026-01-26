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
 */
export type StorageAdapter = {
	getApiKey(): Promise<string | null>;
	saveApiKey(apiKey: string): Promise<void>;
};

/**
 * localStorage adapter for web interface.
 */
export class LocalStorageAdapter implements StorageAdapter {
	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async getApiKey(): Promise<string | null> {
		const apiKey = localStorage.getItem(STORAGE_KEY);
		return apiKey ? apiKey.trim() : null;
	}

	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async saveApiKey(apiKey: string): Promise<void> {
		localStorage.setItem(STORAGE_KEY, apiKey);
	}
}

/**
 * chrome.storage.local adapter for extension.
 */
export class ChromeStorageAdapter implements StorageAdapter {
	async getApiKey(): Promise<string | null> {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		const apiKey = result[STORAGE_KEY];
		return typeof apiKey === "string" ? apiKey.trim() : null;
	}

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
