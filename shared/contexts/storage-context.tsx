/**
 * Storage context for providing storage adapter throughout the app.
 * Eliminates the need to create storage adapters in every component.
 */

import { createStorageAdapter, type StorageAdapter } from "@shared/storage.js";
import { createContext, type ParentComponent, useContext } from "solid-js";

/**
 * Storage context value.
 */
export type StorageContextValue = {
	/**
	 * The storage adapter instance for the current environment.
	 */
	storage: StorageAdapter;
};

/**
 * Storage context.
 * Provides access to the storage adapter throughout the component tree.
 */
const StorageContext = createContext<StorageContextValue>();

/**
 * StorageProvider component.
 * Provides a storage adapter to all descendant components.
 *
 * The storage adapter is created once when the provider mounts and
 * automatically uses the appropriate implementation (chrome.storage for
 * extensions, localStorage for web).
 *
 * @example
 * ```tsx
 * <StorageProvider>
 *   <App />
 * </StorageProvider>
 * ```
 */
export const StorageProvider: ParentComponent = (props) => {
	// Create storage adapter once when provider mounts
	const storage: StorageAdapter = createStorageAdapter();

	return <StorageContext.Provider value={{ storage }}>{props.children}</StorageContext.Provider>;
};

/**
 * Hook to access the storage adapter from context.
 *
 * @returns The storage adapter instance
 * @throws Error if used outside of StorageProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { storage } = useStorage();
 *
 *   const saveApiKey = async (key: string) => {
 *     await storage.set("apiKey", key);
 *   };
 *
 *   return <button onClick={() => saveApiKey("secret")}>Save</button>;
 * }
 * ```
 */
export function useStorage(): StorageContextValue {
	const context = useContext(StorageContext);

	if (!context) {
		throw new Error("useStorage must be used within a StorageProvider");
	}

	return context;
}
