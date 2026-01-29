/**
 * useQueryParams - Hook for handling URL query parameters with auto-submit.
 *
 * Checks for a "url" query parameter on component mount and automatically
 * populates the URL input field. If an API key is available, automatically
 * submits the recipe after a short delay. If no API key is found, shows
 * the API secret prompt first.
 *
 * This enables bookmarklet and browser extension integrations that can
 * pass recipe URLs via query parameters for seamless one-click saving.
 *
 * Usage pattern: `https://your-app.com?url=https://recipe-site.com/recipe`
 *
 * @example
 * ```tsx
 * function WebRecipeForm() {
 *   const scheduleTimeout = useTimeout();
 *
 *   // Hook automatically handles query params on mount
 *   useQueryParams({
 *     storage,
 *     setUrl,
 *     performSave,
 *     setPendingSave,
 *     setShowApiPrompt,
 *     scheduleTimeout
 *   });
 *
 *   // If ?url=... is present, URL input is auto-filled and save triggered
 *   return <input value={url()} />;
 * }
 * ```
 */

import { onMount } from "solid-js";
import { AUTO_SUBMIT_DELAY_MS } from "../constants.js";
import type { StorageAdapter } from "../storage.js";

/**
 * Options for the useQueryParams hook.
 */
export type UseQueryParamsOptions = {
	/**
	 * Storage adapter for checking API key availability.
	 */
	storage: StorageAdapter;
	/**
	 * Function to set the URL input value.
	 */
	setUrl: (url: string) => void;
	/**
	 * Function to trigger save action.
	 */
	performSave: () => Promise<void>;
	/**
	 * Function to set pending save callback.
	 */
	setPendingSave: (callback: (() => void) | null) => void;
	/**
	 * Function to show API secret prompt.
	 */
	setShowApiPrompt: (show: boolean) => void;
	/**
	 * Function to schedule a timeout.
	 */
	scheduleTimeout: (callback: () => void, delay: number) => number;
};

/**
 * Hook for handling URL query parameters with auto-submit functionality.
 *
 * Checks for a "url" query parameter and automatically sets it in the input.
 * If an API key is available, automatically submits after a delay (500ms).
 * If no API key, shows the API secret prompt and queues the save operation.
 *
 * Validates the URL parameter before processing (must be a valid URL).
 *
 * @param options - Configuration options for the hook.
 * @param options.storage - Storage adapter for checking API key.
 * @param options.setUrl - Function to set URL input value.
 * @param options.performSave - Function to trigger save operation.
 * @param options.setPendingSave - Function to queue pending save callback.
 * @param options.setShowApiPrompt - Function to show/hide API prompt.
 * @param options.scheduleTimeout - Function to schedule timeout with cleanup.
 */
export function useQueryParams(options: UseQueryParamsOptions): void {
	const { storage, setUrl, performSave, setPendingSave, setShowApiPrompt, scheduleTimeout } =
		options;

	async function handleQueryParameters() {
		const urlParams = new URLSearchParams(window.location.search);
		const urlParam = urlParams.get("url");

		if (urlParam) {
			try {
				new URL(urlParam);
				setUrl(urlParam);
				const key = await storage.getApiKey();
				if (key) {
					scheduleTimeout(() => {
						performSave();
					}, AUTO_SUBMIT_DELAY_MS);
				} else {
					setPendingSave(() => performSave);
					setShowApiPrompt(true);
				}
			} catch {
				// Invalid URL in query parameters
			}
		}
	}

	onMount(() => {
		handleQueryParameters();
	});
}
