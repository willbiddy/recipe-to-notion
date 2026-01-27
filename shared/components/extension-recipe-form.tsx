/**
 * ExtensionRecipeForm component for the browser extension popup.
 * Handles recipe URL submission from current tab, progress updates, and settings management.
 */

import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { ExtensionMessageType, NOTION_OPEN_DELAY_MS } from "../constants.js";
import { useRecipeSave } from "../hooks/use-recipe-save.js";
import { useTimeout } from "../hooks/use-timeout.js";
import { createStorageAdapter } from "../storage.js";
import { getWebsiteName, isValidHttpUrl } from "../url-utils.js";
import { ApiSecretPrompt } from "./api-secret-prompt.js";
import { ProgressIndicator } from "./progress-indicator.js";
import { StatusMessage, StatusType, TextSize } from "./status-message.js";
import { UrlDisplay } from "./url-display.js";

export type ExtensionRecipeFormProps = {
	/** Function to get the server URL. */
	getServerUrl: () => string;
};

/**
 * Gets the current active tab URL, title, recipe title, and author if available.
 *
 * @returns Object containing URL, title, recipe title, author, and website name.
 */
async function getCurrentTab(): Promise<{
	url: string | null;
	title: string | null;
	recipeTitle: string | null;
	author: string | null;
	websiteName: string | null;
}> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	console.log("[getCurrentTab] Tab data:", {
		tab,
		url: tab?.url,
		title: tab?.title,
		id: tab?.id,
		urlType: typeof tab?.url,
	});

	const url = tab?.url || null;
	const title = tab?.title || null;

	// Log if we got a tab but no URL (permission issue)
	if (tab && !url) {
		console.warn("[getCurrentTab] Tab found but URL is undefined - check extension permissions");
	}

	let recipeTitle: string | null = null;
	let author: string | null = null;
	let websiteName: string | null = null;

	if (url) {
		websiteName = getWebsiteName(url);
		console.log("[getCurrentTab] Website name:", websiteName);
	}

	if (tab?.id && url && isValidHttpUrl(url)) {
		console.log("[getCurrentTab] Attempting to extract recipe data from content script");
		try {
			const response = await chrome.tabs.sendMessage(tab.id, {
				type: ExtensionMessageType.ExtractRecipeData,
			});
			recipeTitle = response?.title || null;
			author = response?.author || null;
			console.log("[getCurrentTab] Recipe data extracted:", { recipeTitle, author });
		} catch (error) {
			console.log("[getCurrentTab] Content script unavailable:", error);
			// Content script unavailable
		}
	} else {
		console.log("[getCurrentTab] Skipping content script:", {
			hasTabId: !!tab?.id,
			hasUrl: !!url,
			isValidUrl: url ? isValidHttpUrl(url) : false,
		});
	}

	const result = {
		url,
		title,
		recipeTitle,
		author,
		websiteName,
	};
	console.log("[getCurrentTab] Returning:", result);
	return result;
}

/**
 * ExtensionRecipeForm component.
 */
export function ExtensionRecipeForm(props: ExtensionRecipeFormProps) {
	const storage = createStorageAdapter();
	const [currentUrl, setCurrentUrl] = createSignal<string | null>(null);
	const [currentTitle, setCurrentTitle] = createSignal<string | null>(null);
	const [recipeTitle, setRecipeTitle] = createSignal<string | null>(null);
	const [recipeAuthor, setRecipeAuthor] = createSignal<string | null>(null);
	const [websiteName, setWebsiteName] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal<{
		message?: string;
		children?: JSX.Element;
		type: StatusType;
	} | null>(null);
	const [progress, setProgress] = createSignal<string | null>(null);
	const [showApiPrompt, setShowApiPrompt] = createSignal(false);
	const [pendingSave, setPendingSave] = createSignal<(() => void) | null>(null);

	const scheduleTimeout = useTimeout();

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
			setStatus({ message: "Recipe saved successfully!", type: StatusType.Success });
			scheduleTimeout(() => {
				setStatus({ message: "Opening...", type: StatusType.Info });
			}, NOTION_OPEN_DELAY_MS);
			scheduleTimeout(() => {
				if (result.notionUrl) {
					chrome.tabs.create({ url: result.notionUrl });
				}
			}, NOTION_OPEN_DELAY_MS * 2);
		},
		onDuplicate: (notionUrl) => {
			setStatus({ message: "This recipe already exists. Opening...", type: StatusType.Info });
			scheduleTimeout(() => {
				chrome.tabs.create({ url: notionUrl });
			}, NOTION_OPEN_DELAY_MS);
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
		console.log("[ExtensionRecipeForm] onMount: Getting current tab");
		const { url, title, recipeTitle, author, websiteName } = await getCurrentTab();
		console.log("[ExtensionRecipeForm] onMount: Setting state", {
			url,
			title,
			recipeTitle,
			author,
			websiteName,
		});
		setCurrentUrl(url);
		setCurrentTitle(title);
		setRecipeTitle(recipeTitle);
		setRecipeAuthor(author);
		setWebsiteName(websiteName);
		console.log("[ExtensionRecipeForm] onMount: State set, currentUrl signal:", currentUrl());
	});

	return (
		<div class="flex flex-col gap-3">
			<UrlDisplay
				url={currentUrl()}
				title={recipeTitle() || currentTitle()}
				source={recipeAuthor() || websiteName()}
			/>

			<button
				id="save-button"
				type="button"
				onClick={handleSave}
				disabled={loading() || isInvalidApiKey()}
				class="btn-primary group"
			>
				<Show
					when={loading()}
					fallback={
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
					}
				>
					<div
						class="button-spinner w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"
						aria-hidden="true"
					/>
				</Show>
				<span class="button-text">{loading() ? "Processing..." : "Save Recipe"}</span>
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
