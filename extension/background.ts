/**
 * Background service worker for the recipe-to-notion extension.
 * Handles context menu and other background tasks.
 */

/**
 * Context menu configuration.
 */
const CONTEXT_MENU = {
	ID: "save-recipe",
	TITLE: "Save Recipe with Recipe Clipper for Notion",
	CONTEXTS: ["page" as chrome.contextMenus.ContextType],
} as const;

/**
 * Icon paths for light and dark themes.
 */
const ICONS = {
	light: {
		16: "icons/icon16.png",
		48: "icons/icon48.png",
		128: "icons/icon128.png",
	},
	dark: {
		16: "icons/icon16-white.png",
		48: "icons/icon48-white.png",
		128: "icons/icon128-white.png",
	},
} as const;

/**
 * Updates the extension icon based on the current theme.
 */
async function updateIcon(theme: "light" | "dark") {
	const iconSet = ICONS[theme];
	await chrome.action.setIcon({
		path: iconSet,
	});
}

/**
 * Gets the current theme preference from storage, defaulting to light.
 */
async function getThemePreference(): Promise<"light" | "dark"> {
	const result = await chrome.storage.local.get("theme");
	return (result.theme as "light" | "dark") || "light";
}

/**
 * Initializes the extension icon based on stored theme preference.
 */
async function initializeIcon() {
	const theme = await getThemePreference();
	await updateIcon(theme);
}

/**
 * Creates context menu item when extension is installed.
 */
chrome.runtime.onInstalled.addListener(() => {
	if (chrome.contextMenus) {
		chrome.contextMenus.create({
			id: CONTEXT_MENU.ID,
			title: CONTEXT_MENU.TITLE,
			contexts: [...CONTEXT_MENU.CONTEXTS],
		});
	}
	// Initialize icon on install
	initializeIcon();
});

/**
 * Listens for theme updates from the popup.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "theme-changed") {
		updateIcon(message.theme);
		sendResponse({ success: true });
	}
	return true; // Keep message channel open for async response
});

/**
 * Listens for storage changes to update icon when theme is detected elsewhere.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === "local" && changes.theme) {
		const newTheme = changes.theme.newValue as "light" | "dark";
		updateIcon(newTheme);
	}
});

/**
 * Initialize icon when service worker starts.
 */
initializeIcon();

/**
 * Handles context menu clicks.
 *
 * Attempts to open the extension popup when the save recipe menu item is selected.
 * Falls back gracefully if popup cannot be opened programmatically (popup cannot
 * be opened programmatically, user must click extension icon).
 */
if (chrome.contextMenus) {
	chrome.contextMenus.onClicked.addListener(async (info, tab) => {
		if (info.menuItemId === CONTEXT_MENU.ID && tab?.url) {
			try {
				await chrome.action.openPopup();
			} catch {
				// Popup unavailable
			}
		}
	});
}
