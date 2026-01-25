/**
 * Background service worker for the recipe-to-notion extension.
 * Handles context menu and other background tasks.
 */

/**
 * Context menu configuration.
 */
const CONTEXT_MENU = {
	ID: "save-recipe",
	TITLE: "Save Recipe with recipe-to-notion",
	CONTEXTS: ["page"] as chrome.contextMenus.ContextType[],
} as const;

/**
 * Creates context menu item when extension is installed.
 */
chrome.runtime.onInstalled.addListener(() => {
	if (chrome.contextMenus) {
		chrome.contextMenus.create({
			id: CONTEXT_MENU.ID,
			title: CONTEXT_MENU.TITLE,
			contexts: CONTEXT_MENU.CONTEXTS,
		});
	}
});

/**
 * Handles context menu clicks.
 *
 * Attempts to open the extension popup when the save recipe menu item is selected.
 * Falls back gracefully if popup cannot be opened programmatically.
 */
if (chrome.contextMenus) {
	chrome.contextMenus.onClicked.addListener(async (info, tab) => {
		if (info.menuItemId === CONTEXT_MENU.ID && tab?.url) {
			try {
				await chrome.action.openPopup();
			} catch {
				// Popup cannot be opened programmatically, user must click extension icon
			}
		}
	});
}
