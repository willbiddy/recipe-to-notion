/**
 * Formatting utilities for displaying data in a human-readable format.
 */

/**
 * Formats minutes into a human-readable time string.
 *
 * @param minutes - The number of minutes to format.
 * @returns A formatted time string like "30m", "1h 15m", or "2h".
 *
 * @example
 * formatTimeMinutes(30) // "30m"
 * formatTimeMinutes(75) // "1h 15m"
 * formatTimeMinutes(120) // "2h"
 * formatTimeMinutes(0) // "0m"
 */
export function formatTimeMinutes(minutes: number): string {
	if (minutes === 0) {
		return "0m";
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	if (hours === 0) {
		return `${remainingMinutes}m`;
	}

	if (remainingMinutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${remainingMinutes}m`;
}
