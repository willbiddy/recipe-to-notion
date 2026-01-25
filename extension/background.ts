/**
 * Background service worker for the Recipe to Notion extension.
 * Handles context menu and other background tasks.
 */

// Create context menu item when extension is installed
chrome.runtime.onInstalled.addListener(() => {
	// Check if contextMenus API is available
	if (chrome.contextMenus) {
		chrome.contextMenus.create({
			id: "save-recipe",
			title: "Save Recipe to Notion",
			contexts: ["page"],
		});
	}
});

// Handle context menu clicks
if (chrome.contextMenus) {
	chrome.contextMenus.onClicked.addListener(async (info, tab) => {
		if (info.menuItemId === "save-recipe" && tab?.url) {
			// Open the extension popup by sending a message
			// The popup will handle the save action
			try {
				// Try to open the popup - this only works from user gesture
				// If that fails, we'll just open the extension page
				await chrome.action.openPopup();
			} catch {
				// If openPopup fails (common in background scripts),
				// we can't programmatically open the popup, so we'll
				// just let the user click the extension icon instead
			}
		}
	});
}
