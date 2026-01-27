/**
 * Theme toggle component - switches between light and dark modes.
 * Displays a sun icon in dark mode and a moon icon in light mode.
 */

import { type Component, Show } from "solid-js";
import { Theme } from "../constants";
import { useTheme } from "../hooks/use-theme";

/**
 * Theme toggle button component.
 * Provides a button to cycle through light/dark/system theme preferences.
 */
export const ThemeToggle: Component = () => {
	const { theme, setTheme, effectiveTheme } = useTheme();

	const handleToggle = () => {
		const currentTheme = theme();
		// Cycle: null (system) -> light -> dark -> null
		if (currentTheme === null) {
			// If following system, set to explicit light
			setTheme(Theme.Light);
		} else if (currentTheme === Theme.Light) {
			// If light, switch to dark
			setTheme(Theme.Dark);
		} else {
			// If dark, switch back to system
			setTheme(null);
		}
	};

	const getAriaLabel = () => {
		const current = effectiveTheme();
		return current === Theme.Dark ? "Switch to light mode" : "Switch to dark mode";
	};

	const getTitle = () => {
		const current = theme();
		if (current === null) {
			return `System theme (currently ${effectiveTheme()})`;
		}
		return `${current === Theme.Light ? "Light" : "Dark"} mode`;
	};

	return (
		<button
			type="button"
			onClick={handleToggle}
			aria-label={getAriaLabel()}
			title={getTitle()}
			class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
		>
			<Show
				when={effectiveTheme() === Theme.Dark}
				fallback={
					// Moon icon (show in light mode)
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-5 h-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				}
			>
				{/* Sun icon (show in dark mode) */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-5 h-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			</Show>
		</button>
	);
};
