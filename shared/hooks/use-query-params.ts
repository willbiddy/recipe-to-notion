/**
 * Hook for handling URL query parameters with auto-submit functionality.
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
 * If an API key is available, automatically submits after a delay.
 *
 * @param options - Configuration options for the hook.
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
