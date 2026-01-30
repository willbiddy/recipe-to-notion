/**
 * useTheme - Hook for accessing theme context (light/dark mode).
 *
 * Provides convenient access to the current theme state and methods for
 * toggling or setting the theme. Must be used within a ThemeProvider.
 *
 * The theme is persisted to storage and automatically applied to the document
 * root element via the ThemeProvider.
 *
 * @returns The theme context value with theme state and methods.
 * @throws {Error} If used outside of ThemeProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, setTheme, toggleTheme } = useTheme();
 *
 *   return (
 *     <div>
 *       <p>Current theme: {theme()}</p>
 *       <button onClick={toggleTheme}>Toggle Theme</button>
 *       <button onClick={() => setTheme('dark')}>Dark Mode</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional rendering based on theme
 * function Icon() {
 *   const { theme } = useTheme();
 *   return theme() === 'dark' ? <MoonIcon /> : <SunIcon />;
 * }
 * ```
 */

import { Theme } from "@shared/constants";
import { ThemeContext, type ThemeContextValue } from "@shared/contexts/theme-context";
import { useContext } from "solid-js";

/**
 * Hook to access the theme context.
 *
 * @returns The theme context value with theme(), setTheme(), and toggleTheme().
 * @throws {Error} If used outside of ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}

/**
 * Detects the system's preferred color scheme.
 *
 * @returns Theme.Dark if the system prefers dark mode, Theme.Light otherwise.
 */
export function detectSystemTheme(): Theme {
	if (
		typeof window !== "undefined" &&
		window.matchMedia &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return Theme.Dark;
	}
	return Theme.Light;
}

/**
 * Resolves the effective theme based on user preference and system theme.
 * If preference is null/undefined, falls back to system theme.
 *
 * @param preference - The user's theme preference, or null to use system theme.
 * @returns The effective theme to apply.
 */
export function getEffectiveTheme(preference: Theme | null | undefined): Theme {
	if (preference === null || preference === undefined) {
		return detectSystemTheme();
	}
	return preference;
}

/**
 * Applies the theme to the document by adding or removing the 'dark' class on the html element.
 *
 * @param theme - The theme to apply.
 */
export function applyThemeToDocument(theme: Theme): void {
	if (typeof document === "undefined") {
		return;
	}

	const htmlElement = document.documentElement;
	if (theme === Theme.Dark) {
		htmlElement.classList.add("dark");
	} else {
		htmlElement.classList.remove("dark");
	}
}

/**
 * Creates a media query listener for system theme changes.
 *
 * @param callback - Function to call when system theme changes.
 * @returns A cleanup function to remove the listener.
 */
export function watchSystemTheme(callback: (theme: Theme) => void): () => void {
	if (typeof window === "undefined" || !window.matchMedia) {
		return () => {};
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const handleChange = (e: MediaQueryListEvent) => {
		callback(e.matches ? Theme.Dark : Theme.Light);
	};

	mediaQuery.addEventListener("change", handleChange);
	return () => mediaQuery.removeEventListener("change", handleChange);
}
