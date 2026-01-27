/**
 * WebRecipeForm component for the web interface.
 * Handles recipe URL submission, progress updates, and settings management.
 */

import type { JSX } from "solid-js";
import { createMemo, createSignal, Show } from "solid-js";
import { ErrorMessageKey } from "../constants.js";
import { useQueryParams } from "../hooks/use-query-params.js";
import { useRecipeSave } from "../hooks/use-recipe-save.js";
import { useTimeout } from "../hooks/use-timeout.js";
import { createStorageAdapter } from "../storage.js";
import { isValidHttpUrl } from "../url-utils.js";
import { ApiSecretPrompt } from "./api-secret-prompt.js";
import { ProgressIndicator } from "./progress-indicator.js";
import { RecipeInfo, type RecipeInfoData } from "./recipe-info.js";
import { StatusMessage, StatusType } from "./status-message.js";

/**
 * Gets the server URL from the current origin.
 *
 * @returns The current window origin URL.
 */
function getServerUrl(): string {
	return window.location.origin;
}

/**
 * WebRecipeForm component.
 */
export function WebRecipeForm() {
	const storage = createStorageAdapter();
	const [url, setUrl] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [status, setStatus] = createSignal<{
		message?: string;
		children?: JSX.Element;
		type: StatusType;
	} | null>(null);
	const [progress, setProgress] = createSignal<string | null>(null);
	const [recipeInfo, setRecipeInfo] = createSignal<RecipeInfoData | null>(null);
	const [savedRecipeName, setSavedRecipeName] = createSignal<string | null>(null);
	const [showApiPrompt, setShowApiPrompt] = createSignal(false);
	const [pendingSave, setPendingSave] = createSignal<(() => void) | null>(null);

	const urlValid = createMemo(() => {
		const currentUrl = url().trim();
		if (currentUrl === "") return null;
		return isValidHttpUrl(currentUrl);
	});

	const showClearButton = createMemo(() => url().trim() !== "");

	const scheduleTimeout = useTimeout();

	const {
		performSave,
		isInvalidApiKey,
		handleApiSecretSaved: createHandleApiSecretSaved,
		handleUpdateApiKey: createHandleUpdateApiKey,
	} = useRecipeSave({
		storage,
		getApiUrl: () => `${getServerUrl()}/api/recipes`,
		getCurrentUrl: () => url().trim() || null,
		setStatus,
		setLoading,
		setProgress,
		onSuccess: (result) => {
			// Set success message with recipe title and Notion link
			const recipeName = savedRecipeName() || recipeInfo()?.recipe.name || "Recipe";
			setStatus({
				children: (
					<>
						Recipe "{recipeName}" saved successfully!{" "}
						<a
							href={result.notionUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="underline font-semibold"
						>
							Open in Notion
						</a>
					</>
				),
				type: StatusType.Success,
			});
			// Clear URL immediately after successful save
			clearUrl();
		},
		onComplete: (data) => {
			setRecipeInfo(data);
			setSavedRecipeName(data.recipe.name);
		},
		noUrlErrorKey: ErrorMessageKey.PleaseEnterRecipeUrl,
	});

	async function handleSave() {
		const apiKey = await storage.getApiKey();
		if (!apiKey) {
			setPendingSave(() => performSave);
			setShowApiPrompt(true);
			return;
		}

		setStatus(null);
		setRecipeInfo(null);
		setSavedRecipeName(null);
		await performSave();
	}

	function clearUrl() {
		setUrl("");
	}

	function handleUrlInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		setUrl(value);
	}

	/**
	 * Handles keyboard shortcuts for save action.
	 *
	 * @param e - The keyboard event.
	 */
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
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

	useQueryParams({
		storage,
		setUrl,
		performSave,
		setPendingSave,
		setShowApiPrompt,
		scheduleTimeout,
	});

	return (
		<div class="flex flex-col gap-3">
			<div class="relative">
				<label
					for="url-input"
					class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
				>
					Recipe URL
				</label>
				<input
					type="url"
					id="url-input"
					name="recipe-url"
					value={url()}
					onInput={handleUrlInput}
					onKeyDown={handleKeyDown}
					autocomplete="url"
					aria-invalid={urlValid() === false ? "true" : "false"}
					class="input-field-minimal"
				/>
				<Show when={showClearButton()}>
					<button
						type="button"
						onClick={clearUrl}
						class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
						aria-label="Clear URL"
						title="Clear URL"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</Show>
				<div class="sr-only" aria-live="polite" aria-atomic="true">
					<Show when={urlValid() !== null}>{urlValid() ? "Valid URL" : "Invalid URL format"}</Show>
				</div>
			</div>

			<button
				type="button"
				onClick={handleSave}
				disabled={loading()}
				aria-label="Save recipe with Recipe Clipper for Notion"
				class="btn-primary-minimal group"
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
				<span>{loading() ? "Processing..." : "Save Recipe"}</span>
			</button>

			<Show when={progress()}>{(msg) => <ProgressIndicator message={msg()} />}</Show>

			<Show when={status()}>
				{(s) => (
					<div class="flex flex-col gap-2">
						<StatusMessage message={s().message} type={s().type}>
							{s().children}
						</StatusMessage>
						<Show when={isInvalidApiKey()}>
							<button
								type="button"
								onClick={handleUpdateApiKey}
								class="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200"
							>
								Update API Secret
							</button>
						</Show>
					</div>
				)}
			</Show>

			<Show when={recipeInfo()}>{(info) => <RecipeInfo data={info()} />}</Show>

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
