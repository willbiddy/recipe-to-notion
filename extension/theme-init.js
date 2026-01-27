/**
 * Theme initialization script for extension popup.
 * Applies theme immediately to prevent flash of unstyled content.
 * Must run before popup.js to ensure theme is applied before React renders.
 */

// Apply theme immediately to prevent flash
(async () => {
	const result = await chrome.storage.local.get("theme");
	const theme = result.theme;
	const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const isDark = theme === "dark" || (!theme && systemDark);
	if (isDark) {
		document.documentElement.classList.add("dark");
	}
})();
