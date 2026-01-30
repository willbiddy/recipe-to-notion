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
