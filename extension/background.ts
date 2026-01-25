/**
 * Background service worker for the Recipe Clipper for Notion extension.
 * Handles context menu and other background tasks.
 */

/**
 * Creates context menu item when extension is installed.
 */
chrome.runtime.onInstalled.addListener(() => {
	if (chrome.contextMenus) {
		chrome.contextMenus.create({
			id: "save-recipe",
			title: "Save Recipe with Recipe Clipper for Notion",
			contexts: ["page"],
		});
	}
});

/**
 * Handles context menu clicks.
 *
 * Attempts to open the extension popup when "Save Recipe with Recipe Clipper for Notion" is selected.
 * Falls back gracefully if popup cannot be opened programmatically.
 */
if (chrome.contextMenus) {
	chrome.contextMenus.onClicked.addListener(async (info, tab) => {
		if (info.menuItemId === "save-recipe" && tab?.url) {
			try {
				await chrome.action.openPopup();
			} catch {
				// Popup cannot be opened programmatically, user must click extension icon
			}
		}
	});
}
