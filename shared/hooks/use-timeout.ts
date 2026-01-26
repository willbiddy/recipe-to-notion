/**
 * Hook for managing timeouts in Solid.js components.
 * Automatically cleans up timeouts when the component unmounts.
 */

import { onCleanup } from "solid-js";

/**
 * Returns a function to create timeouts that are automatically cleaned up.
 *
 * @returns Function that creates a timeout and returns its ID.
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
