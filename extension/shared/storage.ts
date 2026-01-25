/**
 * Storage abstraction for API key management.
 * Supports both localStorage (web) and chrome.storage.local (extension).
 */

/**
 * Storage interface for API key operations.
 */
export interface StorageAdapter {
	getApiKey(): Promise<string | null>;
	saveApiKey(apiKey: string): Promise<void>;
}

/**
 * localStorage adapter for web interface.
 */
export class LocalStorageAdapter implements StorageAdapter {
	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async getApiKey(): Promise<string | null> {
		const apiKey = localStorage.getItem("apiKey");
		return apiKey ? apiKey.trim() : null;
	}

	// biome-ignore lint/suspicious/useAwait: Methods are async to match StorageAdapter interface, even though localStorage is synchronous
	async saveApiKey(apiKey: string): Promise<void> {
		localStorage.setItem("apiKey", apiKey);
	}
}

/**
 * chrome.storage.local adapter for extension.
 */
export class ChromeStorageAdapter implements StorageAdapter {
	async getApiKey(): Promise<string | null> {
		const result = await chrome.storage.local.get("apiKey");
		const apiKey = result.apiKey;
		return typeof apiKey === "string" ? apiKey : null;
	}

	async saveApiKey(apiKey: string): Promise<void> {
		await chrome.storage.local.set({ apiKey });
	}
}

/**
 * Creates a storage adapter based on the environment.
 */
export function createStorageAdapter(): StorageAdapter {
	// Check if we're in a Chrome extension context
	if (typeof chrome !== "undefined" && chrome.storage) {
		return new ChromeStorageAdapter();
	}
	return new LocalStorageAdapter();
}
