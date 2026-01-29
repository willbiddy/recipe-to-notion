/**
 * useTimeout - Hook for managing timeouts with automatic cleanup in Solid.js.
 *
 * Provides a timeout scheduling function that automatically cleans up all
 * pending timeouts when the component unmounts. This prevents memory leaks
 * and callbacks firing after component destruction.
 *
 * Particularly useful for delayed operations like auto-submit, debouncing,
 * or timed notifications that need cleanup on unmount.
 *
 * @returns Function to schedule timeouts with automatic cleanup.
 *
 * @example
 * ```tsx
 * function AutoSubmitForm() {
 *   const scheduleTimeout = useTimeout();
 *
 *   function handleInput(value: string) {
 *     setUrl(value);
 *
 *     // Auto-submit after 2 seconds of inactivity
 *     scheduleTimeout(() => {
 *       submitForm();
 *     }, 2000);
 *   }
 *
 *   // All timeouts automatically cancelled on unmount
 *   return <input onInput={(e) => handleInput(e.target.value)} />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Used for auto-submitting recipe from query params
 * const scheduleTimeout = useTimeout();
 *
 * onMount(() => {
 *   const urlParam = getQueryParam('url');
 *   if (urlParam) {
 *     setUrl(urlParam);
 *     // Auto-submit after delay
 *     scheduleTimeout(() => performSave(), 500);
 *   }
 * });
 * ```
 */

import { onCleanup } from "solid-js";

/**
 * Returns a function to create timeouts that are automatically cleaned up on component unmount.
 *
 * @returns Function that schedules a timeout and returns its ID.
 * The returned function signature is: (callback: () => void, delay: number) => number
 */
export function useTimeout(): (callback: () => void, delay: number) => number {
	const timeoutIds: number[] = [];

	onCleanup(() => {
		for (const id of timeoutIds) {
			clearTimeout(id);
		}
	});

	return (callback: () => void, delay: number): number => {
		const id = window.setTimeout(callback, delay);
		timeoutIds.push(id);
		return id;
	};
}
