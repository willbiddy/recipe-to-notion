/**
 * WebRecipeForm - Main form component for the web interface.
 *
 * Provides a URL input field for users to manually enter recipe URLs, handles
 * recipe saving with real-time progress updates, and displays success/error messages.
 * Supports URL query parameter auto-submission and API key management.
 *
 * Features:
 * - Manual URL input with validation and clear button
 * - Keyboard shortcuts (Enter to save, Escape in prompts)
 * - Real-time progress indicator during save
 * - Success message with "Open in Notion" link
 * - Duplicate recipe detection
 * - API key prompt when needed
 * - Query parameter support (?url=... for bookmarklet integration)
 * - Auto-clears URL after successful save
 *
 * @example
 * ```tsx
 * <WebRecipeForm />
 * ```
 *
 * @example
 * // With query parameters (auto-submits):
 * // https://example.com?url=https://recipe-site.com/recipe
 */

import type { RecipeFormShellHandlers } from "@shared/components/recipe-form-shell.js";
import { RecipeFormShell } from "@shared/components/recipe-form-shell.js";
import { StatusType } from "@shared/components/status-message.js";
import { ErrorMessageKey } from "@shared/constants.js";
import { useStorage } from "@shared/contexts/storage-context.js";
import { useQueryParams } from "@shared/hooks/use-query-params.js";
import { useTimeout } from "@shared/hooks/use-timeout.js";
import { isValidHttpUrl } from "@shared/url-utils.js";
import { createMemo, createSignal, Show } from "solid-js";

/**
 * Gets the server URL from the current origin.
 *
 * Uses window.location.origin to automatically determine the base URL.
 *
 * @returns The current window origin URL (e.g., "https://example.com").
 */
function getServerUrl(): string {
	return window.location.origin;
}

/**
 * WebRecipeForm component.
 *
 * Renders a form with URL input, validation, save button, progress indicator,
 * and status messages. Integrates with useQueryParams hook for auto-submission.
 */
export function WebRecipeForm() {
	const { storage } = useStorage();
	const [url, setUrl] = createSignal("");
	const [savedRecipeName, setSavedRecipeName] = createSignal<string | null>(null);

	const urlValid = createMemo(() => {
		const currentUrl = url().trim();
		if (currentUrl === "") return null;
		return isValidHttpUrl(currentUrl);
	});

	const showClearButton = createMemo(() => url().trim() !== "");

	const scheduleTimeout = useTimeout();

	// Capture shell handlers for query params integration
	let shellHandlers: RecipeFormShellHandlers | null = null;

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
			shellHandlers?.performSave();
		}
	}

	// Query params integration: auto-submit from URL parameters
	useQueryParams({
		storage,
		setUrl,
		performSave: () => shellHandlers?.performSave() || Promise.resolve(),
		setPendingSave: (callback) => shellHandlers?.setPendingSave(callback),
		setShowApiPrompt: (show) => shellHandlers?.setShowApiPrompt(show),
		scheduleTimeout,
	});

	return (
		<RecipeFormShell
			urlSource={
				<div>
					<label
						for="url-input"
						class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
					>
						Recipe URL
					</label>
					<div class="relative">
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
					</div>
					<div class="sr-only" aria-live="polite" aria-atomic="true">
						<Show when={urlValid() !== null}>
							{urlValid() ? "Valid URL" : "Invalid URL format"}
						</Show>
					</div>
				</div>
			}
			getCurrentUrl={() => url().trim() || null}
			getApiUrl={() => `${getServerUrl()}/api/recipes`}
			onSuccess={(result) => {
				// Set success message with recipe title and Notion link
				const recipeName = savedRecipeName() || "Recipe";
				// Clear URL after successful save
				clearUrl();
				return {
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
				};
			}}
			onComplete={(data) => {
				setSavedRecipeName(data.recipe.name);
			}}
			onShellReady={(handlers) => {
				shellHandlers = handlers;
			}}
			buttonClass="btn-primary-minimal"
			noUrlErrorKey={ErrorMessageKey.PleaseEnterRecipeUrl}
		/>
	);
}
