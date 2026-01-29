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

import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { ExtensionMessageType } from "../constants.js";
import { useRecipeSave } from "../hooks/use-recipe-save.js";
import { createStorageAdapter } from "../storage.js";
import { getWebsiteName, isValidHttpUrl } from "../url-utils.js";
import { ApiSecretPrompt } from "./api-secret-prompt.js";
import { ProgressIndicator } from "./progress-indicator.js";
import { StatusMessage, StatusType, TextSize } from "./status-message.js";
import { UrlDisplay } from "./url-display.js";

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
async function getCurrentTab(setPermissionIssue?: (value: boolean) => void): Promise<{
	url: string | null;
	title: string | null;
	recipeTitle: string | null;
	author: string | null;
	websiteName: string | null;
}> {
	// Check if tabs permission is actually granted
	const hasTabsPermission = await chrome.permissions.contains({
		permissions: ["tabs"],
	});

	if (!hasTabsPermission) {
		console.error("[getCurrentTab] MISSING TABS PERMISSION - Requesting it now");
		if (setPermissionIssue) {
			setPermissionIssue(true);
		}
		// Attempt to request permission at runtime
		try {
			const granted = await chrome.permissions.request({
				permissions: ["tabs"],
			});
			if (granted && setPermissionIssue) {
				setPermissionIssue(false);
			}
		} catch (err) {
			console.error("[getCurrentTab] Permission request failed:", err);
		}
	}

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

	let url = tab?.url || null;
	let title = tab?.title || null;

	// If tab.url is undefined, try content script fallback
	if (tab && !url && tab.id) {
		try {
			const response = await chrome.tabs.sendMessage(tab.id, {
				type: ExtensionMessageType.GetPageUrl,
			});
			url = response?.url || null;
			title = response?.title || title;
		} catch (error) {
			console.error("[getCurrentTab] Content script fallback failed:", error);
		}
	}

	let recipeTitle: string | null = null;
	let author: string | null = null;
	let websiteName: string | null = null;

	if (url) {
		websiteName = getWebsiteName(url);
	}

	if (tab?.id && url && isValidHttpUrl(url)) {
		try {
			const response = await chrome.tabs.sendMessage(tab.id, {
				type: ExtensionMessageType.ExtractRecipeData,
			});
			recipeTitle = response?.title || null;
			author = response?.author || null;
		} catch {
			// Content script unavailable
		}
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
	const storage = createStorageAdapter();
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
