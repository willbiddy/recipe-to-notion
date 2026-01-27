/**
 * Theme context for managing dark mode state across the application.
 * Provides theme preference, effective theme, and theme switching functionality.
 */

import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
} from "solid-js";
import type { Theme } from "../constants";
import { createStorageAdapter, type StorageAdapter } from "../storage";
import {
	applyThemeToDocument,
	detectSystemTheme,
	getEffectiveTheme,
	watchSystemTheme,
} from "../utils/theme-utils";

/**
 * Theme context value interface.
 */
export type ThemeContextValue = {
	/**
	 * The user's theme preference (null means follow system).
	 */
	theme: Accessor<Theme | null>;
	/**
	 * Sets the user's theme preference.
	 */
	setTheme: (theme: Theme | null) => void;
	/**
	 * The effective theme being displayed (always Light or Dark).
	 */
	effectiveTheme: Accessor<Theme>;
};

/**
 * Theme context - provides theme state and methods to child components.
 */
export const ThemeContext = createContext<ThemeContextValue>();

/**
 * Theme provider component.
 * Manages theme state, persistence, and synchronization with system preferences.
 *
 * @param props - Component props with children.
 */
export const ThemeProvider: ParentComponent = (props) => {
	const storage: StorageAdapter = createStorageAdapter();

	// User's theme preference (null = follow system)
	const [theme, setThemeInternal] = createSignal<Theme | null>(null);

	// System theme detection (underscore prefix indicates intentionally unused in render)
	const [_systemTheme, setSystemTheme] = createSignal<Theme>(detectSystemTheme());

	// Effective theme (resolved preference)
	const effectiveTheme = (): Theme => {
		return getEffectiveTheme(theme());
	};

	/**
	 * Sets the theme and persists it to storage.
	 */
	const setTheme = (newTheme: Theme | null) => {
		setThemeInternal(newTheme);
		storage.saveTheme(newTheme);
	};

	// Load theme from storage on mount
	onMount(async () => {
		const storedTheme = await storage.getTheme();
		setThemeInternal(storedTheme);
	});

	// Watch for system theme changes
	onMount(() => {
		const cleanup = watchSystemTheme((newSystemTheme) => {
			setSystemTheme(newSystemTheme);
		});
		onCleanup(cleanup);
	});

	// Apply theme to document whenever effective theme changes
	createEffect(() => {
		const currentTheme = effectiveTheme();
		applyThemeToDocument(currentTheme);
	});

	const contextValue: ThemeContextValue = {
		theme,
		setTheme,
		effectiveTheme,
	};

	return <ThemeContext.Provider value={contextValue}>{props.children}</ThemeContext.Provider>;
};
