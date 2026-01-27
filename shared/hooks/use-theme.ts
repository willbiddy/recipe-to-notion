/**
 * Hook for accessing theme context.
 * Provides convenient access to theme state and methods.
 */

import { useContext } from "solid-js";
import { ThemeContext, type ThemeContextValue } from "../contexts/theme-context";

/**
 * Hook to access the theme context.
 *
 * @returns The theme context value with theme state and methods.
 * @throws Error if used outside of ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
