/**
 * ExtensionRecipeForm - Main form component for the browser extension popup.
 *
 * Displays the current tab's URL/title, handles recipe saving with progress updates,
 * manages API key prompts, and shows success/error status messages. Automatically
 * detects recipe metadata (title, author) from the current page using content scripts.
 *
 * Features:
 * - Auto-fetches current tab URL and extracts recipe data
 * - Handles tab permissions (requests if missing)
 * - Shows real-time progress during save operation
 * - Displays success with "Open in Notion" button
 * - Handles duplicate detection
 * - Manages API key prompts when needed
 *
 * @example
 * ```tsx
 * <ExtensionRecipeForm
 *   getServerUrl={() => "http://localhost:3000"}
 * />
 * ```
 */

import { ApiSecretPrompt } from "@shared/components/api-secret-prompt.js";
import { ProgressIndicator } from "@shared/components/progress-indicator.js";
import { StatusMessage, StatusType, TextSize } from "@shared/components/status-message.js";
import { UrlDisplay } from "@shared/components/url-display.js";
import { ExtensionMessageType } from "@shared/constants.js";
import { useStorage } from "@shared/contexts/storage-context.js";
import { useRecipeSave } from "@shared/hooks/use-recipe-save.js";
import { getWebsiteName, isValidHttpUrl } from "@shared/url-utils.js";
import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";

/**
 * Props for ExtensionRecipeForm component.
 */
export type ExtensionRecipeFormProps = {
	/**
	 * Function to get the server URL.
	 * Should return the base URL (e.g., "http://localhost:3000") without trailing slash.
	 */
	getServerUrl: () => string;
};

/**
 * Gets the current active tab URL, title, recipe title, and author if available.
 *
 * Queries the active tab using chrome.tabs API, handles permission checks/requests,
 * and falls back to content script communication if tab.url is restricted.
 * Attempts to extract recipe metadata (title, author) via content script.
 *
 * @param setPermissionIssue - Optional setter to update permission issue state.
 * @returns Object containing URL, title, recipe title, author, and website name.
 */
/**
 * Checks if the extension has tabs permission and requests it if missing.
 * @param setPermissionIssue - Optional callback to notify about permission state
 */
async function checkTabsPermission(setPermissionIssue?: (value: boolean) => void): Promise<void> {
	const hasTabsPermission = await chrome.permissions.contains({
		permissions: ["tabs"],
	});

	if (!hasTabsPermission) {
		console.error("[getCurrentTab] MISSING TABS PERMISSION - Requesting it now");
		setPermissionIssue?.(true);

		// Attempt to request permission at runtime
		try {
			const granted = await chrome.permissions.request({
				permissions: ["tabs"],
			});
			if (granted) {
				setPermissionIssue?.(false);
			}
		} catch (err) {
			console.error("[getCurrentTab] Permission request failed:", err);
		}
	}
}

/**
 * Gets the currently active tab in the current window.
 * @returns The active tab or undefined if not found
 */
async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

/**
 * Attempts to get the current page URL from the content script.
 * Used as a fallback when tab.url is undefined (e.g., file:// URLs or restricted pages).
 * @param tabId - The ID of the tab to query
 * @returns Object with URL and title, or nulls if the content script is unavailable
 */
async function getUrlFromContentScript(
	tabId: number,
): Promise<{ url: string | null; title: string | null }> {
	try {
		const response = await chrome.tabs.sendMessage(tabId, {
			type: ExtensionMessageType.GetPageUrl,
		});
		return {
			url: response?.url || null,
			title: response?.title || null,
		};
	} catch (error) {
		console.error("[getCurrentTab] Content script fallback failed:", error);
		return { url: null, title: null };
	}
}

/**
 * Extracts recipe metadata (title and author) from the current page via content script.
 * @param tabId - The ID of the tab to extract from
 * @param url - The URL of the page (must be a valid HTTP(S) URL)
 * @returns Object with recipe title and author, or nulls if extraction fails
 */
async function extractRecipeMetadata(
	tabId: number,
	url: string,
): Promise<{ recipeTitle: string | null; author: string | null }> {
	if (!isValidHttpUrl(url)) {
		return { recipeTitle: null, author: null };
	}

	try {
		const response = await chrome.tabs.sendMessage(tabId, {
			type: ExtensionMessageType.ExtractRecipeData,
		});
		return {
			recipeTitle: response?.title || null,
			author: response?.author || null,
		};
	} catch {
		// Expected: Content script not yet injected or page doesn't support messaging
		// This is not an error - we'll proceed without recipe metadata
		// The scraper will extract the recipe data from the URL instead
		return { recipeTitle: null, author: null };
	}
}

/**
 * Gets current tab information including URL, title, and recipe metadata.
 * Orchestrates permission checking, tab querying, and metadata extraction.
 * @param setPermissionIssue - Optional callback to notify about permission state
 * @returns Object with all tab and recipe information
 */
async function getCurrentTab(setPermissionIssue?: (value: boolean) => void): Promise<{
	url: string | null;
	title: string | null;
	recipeTitle: string | null;
	author: string | null;
	websiteName: string | null;
}> {
	// 1. Check and request permissions if needed
	await checkTabsPermission(setPermissionIssue);

	// 2. Get the active tab
	const tab = await getActiveTab();

	// 3. Extract URL and title (with content script fallback if needed)
	let url = tab?.url || null;
	let title = tab?.title || null;

	if (tab?.id && !url) {
		const fallback = await getUrlFromContentScript(tab.id);
		url = fallback.url;
		title = fallback.title || title;
	}

	// 4. Extract website name from URL
	const websiteName = url ? getWebsiteName(url) : null;

	// 5. Extract recipe metadata from content script
	let recipeTitle: string | null = null;
	let author: string | null = null;

	if (tab?.id && url) {
		const metadata = await extractRecipeMetadata(tab.id, url);
		recipeTitle = metadata.recipeTitle;
		author = metadata.author;
	}

	return {
		url,
		title,
		recipeTitle,
		author,
		websiteName,
	};
}

/**
 * ExtensionRecipeForm component.
 *
 * @param props - Component props.
 * @param props.getServerUrl - Function returning the server base URL.
 */
export function ExtensionRecipeForm(props: ExtensionRecipeFormProps) {
	const { storage } = useStorage();
	const [currentUrl, setCurrentUrl] = createSignal<string | null>(null);
	const [currentTitle, setCurrentTitle] = createSignal<string | null>(null);
	const [recipeTitle, setRecipeTitle] = createSignal<string | null>(null);
	const [recipeAuthor, setRecipeAuthor] = createSignal<string | null>(null);
	const [websiteName, setWebsiteName] = createSignal<string | null>(null);
	const [permissionIssue, setPermissionIssue] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal<{
		message?: string;
		children?: JSX.Element;
		type: StatusType;
	} | null>(null);
	const [progress, setProgress] = createSignal<string | null>(null);
	const [showApiPrompt, setShowApiPrompt] = createSignal(false);
	const [pendingSave, setPendingSave] = createSignal<(() => void) | null>(null);

	const {
		performSave,
		isInvalidApiKey,
		handleApiSecretSaved: createHandleApiSecretSaved,
		handleUpdateApiKey: createHandleUpdateApiKey,
	} = useRecipeSave({
		storage,
		getApiUrl: () => `${props.getServerUrl()}/api/recipes`,
		getCurrentUrl: () => currentUrl(),
		setStatus,
		setLoading,
		setProgress,
		onSuccess: (result) => {
			setStatus({
				children: (
					<>
						Recipe saved successfully!{" "}
						<button
							type="button"
							onClick={() => {
								if (result.notionUrl) {
									chrome.tabs.create({ url: result.notionUrl });
								}
							}}
							class="underline font-semibold bg-transparent border-none p-0 cursor-pointer text-inherit hover:opacity-80"
						>
							Open in Notion
						</button>
					</>
				),
				type: StatusType.Success,
			});
		},
		onDuplicate: (notionUrl) => {
			setStatus({
				children: (
					<>
						This recipe already exists.{" "}
						<button
							type="button"
							onClick={() => {
								chrome.tabs.create({ url: notionUrl });
							}}
							class="underline font-semibold bg-transparent border-none p-0 cursor-pointer text-inherit hover:opacity-80"
						>
							Open in Notion
						</button>
					</>
				),
				type: StatusType.Info,
			});
			return undefined;
		},
	});

	async function handleSave() {
		const apiKey = await storage.getApiKey();
		if (!apiKey) {
			setPendingSave(() => performSave);
			setShowApiPrompt(true);
			return;
		}

		await performSave();
	}

	function handleApiSecretSaved() {
		createHandleApiSecretSaved({
			setShowApiPrompt,
			setPendingSave,
			pendingSave,
			performSave,
		});
	}

	function handleUpdateApiKey() {
		createHandleUpdateApiKey({
			setShowApiPrompt,
			setPendingSave,
			pendingSave,
			performSave,
		});
	}

	onMount(async () => {
		const { url, title, recipeTitle, author, websiteName } =
			await getCurrentTab(setPermissionIssue);
		setCurrentUrl(url);
		setCurrentTitle(title);
		setRecipeTitle(recipeTitle);
		setRecipeAuthor(author);
		setWebsiteName(websiteName);
	});

	return (
		<div class="flex flex-col gap-3">
			<UrlDisplay
				url={currentUrl()}
				title={recipeTitle() || currentTitle()}
				source={recipeAuthor() || websiteName()}
				permissionIssue={permissionIssue()}
			/>

			<button
				id="save-button"
				type="button"
				onClick={handleSave}
				disabled={loading() || isInvalidApiKey()}
				class="btn-primary group"
			>
				<svg
					class="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				<span class="button-text">Save Recipe</span>
			</button>

			<Show when={progress()}>{(msg) => <ProgressIndicator message={msg()} />}</Show>

			<Show when={status()}>
				{(s) => (
					<div class="flex flex-col gap-2">
						<StatusMessage message={s().message} type={s().type} textSize={TextSize.Xs}>
							{s().children}
						</StatusMessage>
						<Show when={isInvalidApiKey()}>
							<button
								type="button"
								onClick={handleUpdateApiKey}
								class="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors duration-200"
							>
								Update API Secret
							</button>
						</Show>
					</div>
				)}
			</Show>

			<Show when={showApiPrompt()}>
				<ApiSecretPrompt
					onSecretSaved={handleApiSecretSaved}
					onCancel={() => {
						setShowApiPrompt(false);
						setPendingSave(null);
					}}
				/>
			</Show>
		</div>
	);
}
