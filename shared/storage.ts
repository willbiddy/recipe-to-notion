/**
 * Storage abstraction for API key management and theme preferences.
 * Supports both localStorage (web) and chrome.storage.local (extension).
 */

import { Theme } from "@shared/constants";

/** Storage keys used across the application. */
export enum StorageKey {
	ApiKey = "apiKey",
	Theme = "theme",
}

/** Storage backends available. */
export enum StorageBackend {
	Chrome = "chrome",
	Local = "local",
}

/** Storage interface for API keys and theme preferences. */
export type StorageAdapter = {
	getApiKey(): Promise<string | null>;
	saveApiKey(apiKey: string): Promise<void>;
	getTheme(): Promise<Theme | null>;
	saveTheme(theme: Theme | null): Promise<void>;
};

/** Detects the available storage backend. */
function detectStorageBackend(): StorageBackend {
	return typeof chrome !== "undefined" && chrome.storage
		? StorageBackend.Chrome
		: StorageBackend.Local;
}

/** Unified storage adapter that works in both extension and web contexts. */
export class UnifiedStorageAdapter implements StorageAdapter {
	private backend: StorageBackend;

	constructor(backend: StorageBackend = detectStorageBackend()) {
		this.backend = backend;
	}

	async getApiKey(): Promise<string | null> {
		if (this.backend === StorageBackend.Chrome) {
			const result = await chrome.storage.local.get(StorageKey.ApiKey);
			const apiKey = result[StorageKey.ApiKey];
			return typeof apiKey === "string" ? apiKey.trim() : null;
		}
		const apiKey = localStorage.getItem(StorageKey.ApiKey);
		return apiKey ? apiKey.trim() : null;
	}

	async saveApiKey(apiKey: string): Promise<void> {
		if (this.backend === StorageBackend.Chrome) {
			await chrome.storage.local.set({ [StorageKey.ApiKey]: apiKey });
		} else {
			localStorage.setItem(StorageKey.ApiKey, apiKey);
		}
	}

	async getTheme(): Promise<Theme | null> {
		let theme: string | null;
		if (this.backend === StorageBackend.Chrome) {
			const result = await chrome.storage.local.get(StorageKey.Theme);
			theme = result[StorageKey.Theme] as string | null;
		} else {
			theme = localStorage.getItem(StorageKey.Theme);
		}
		return theme === Theme.Light || theme === Theme.Dark ? theme : null;
	}

	async saveTheme(theme: Theme | null): Promise<void> {
		const key = StorageKey.Theme;
		if (this.backend === StorageBackend.Chrome) {
			if (theme === null) {
				await chrome.storage.local.remove(key as string);
			} else {
				await chrome.storage.local.set({ [key]: theme });
			}
		} else if (theme === null) {
			localStorage.removeItem(key);
		} else {
			localStorage.setItem(key, theme);
		}
	}
}

/** Creates a storage adapter based on the environment (Chrome extension or web). */
export function createStorageAdapter(): StorageAdapter {
	return new UnifiedStorageAdapter();
}
