/**
 * RecipeFormShell - Shared UI and logic for recipe save forms.
 *
 * Provides a reusable shell component that encapsulates common recipe saving
 * functionality for both web and extension interfaces. Handles progress tracking,
 * status messages, API key prompts, and error handling.
 *
 * This component eliminates 200+ lines of duplication between WebRecipeForm
 * and ExtensionRecipeForm by extracting all shared logic into a single component.
 *
 * Platform-specific components provide:
 * - URL source (input field vs tab detection)
 * - Success handling (link vs button with chrome.tabs)
 * - API endpoint URL
 *
 * @example
 * ```tsx
 * <RecipeFormShell
 *   urlSource={<input type="url" ... />}
 *   getCurrentUrl={() => url().trim() || null}
 *   getApiUrl={() => `${origin}/api/recipes`}
 *   onSuccess={(result) => {
 *     setStatus({
 *       children: <a href={result.notionUrl}>Open in Notion</a>,
 *       type: StatusType.Success
 *     });
 *   }}
 *   buttonClass="btn-primary-minimal"
 * />
 * ```
 */

import type { RecipeResponse } from "@shared/api/types";
import { ApiSecretPrompt } from "@shared/components/api-secret-prompt";
import { ProgressIndicator } from "@shared/components/progress-indicator";
import { StatusMessage, type StatusType, type TextSize } from "@shared/components/status-message";
import type { ErrorMessageKey } from "@shared/constants";
import { useStorage } from "@shared/contexts/storage-context";
import { useRecipeSave } from "@shared/hooks/use-recipe-save";
import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";

/**
 * Internal handlers exposed by RecipeFormShell for platform-specific integrations.
 * These allow parent components to trigger saves programmatically (e.g., for query params).
 */
export type RecipeFormShellHandlers = {
	/**
	 * Triggers a recipe save operation.
	 * Checks for API key and shows prompt if missing.
	 */
	performSave: () => Promise<void>;
	/**
	 * Sets a pending save callback to execute after API key is entered.
	 */
	setPendingSave: (callback: (() => void) | null) => void;
	/**
	 * Shows or hides the API secret prompt modal.
	 */
	setShowApiPrompt: (show: boolean) => void;
};

/**
 * Props for RecipeFormShell component.
 */
export type RecipeFormShellProps = {
	/**
	 * JSX element for the URL source (input field or tab display).
	 * Platform-specific: Web uses input, Extension uses UrlDisplay.
	 */
	urlSource: JSX.Element;
	/**
	 * Function returning the current recipe URL to save.
	 * Platform-specific: Web returns input value, Extension returns current tab URL.
	 */
	getCurrentUrl: () => string | null;
	/**
	 * Function returning the API endpoint URL.
	 * Platform-specific: Web uses window.location.origin, Extension uses config.
	 */
	getApiUrl: () => string;
	/**
	 * Callback invoked when recipe is successfully saved.
	 * Should return the status message to display.
	 * Platform-specific: Web shows link, Extension shows button.
	 *
	 * Additionally, callback can perform side effects like clearing URL input.
	 */
	onSuccess: (result: RecipeResponse) => {
		message?: string;
		children?: JSX.Element;
		type: StatusType;
	};
	/**
	 * Optional callback for duplicate recipe detection.
	 * Should return the status message to display.
	 * Platform-specific: Extension may provide this, Web may not.
	 */
	onDuplicate?: (notionUrl: string) => {
		message?: string;
		children?: JSX.Element;
		type: StatusType;
	};
	/**
	 * Optional callback invoked when recipe metadata is extracted.
	 * Used by platform-specific components to capture recipe name for success messages.
	 */
	onComplete?: (data: {
		pageId: string;
		notionUrl: string;
		recipe: {
			name: string;
			author: string | null;
			ingredients: string[];
			instructions: string[];
		};
		tags: {
			tags: string[];
			mealType: string;
			healthScore: number;
			totalTimeMinutes: number;
		};
	}) => void;
	/**
	 * Optional callback invoked when shell is ready, receiving internal handlers.
	 * Used for platform-specific integrations like query params auto-submit.
	 * Called synchronously during component setup (before first render).
	 */
	onShellReady?: (handlers: RecipeFormShellHandlers) => void;
	/**
	 * Optional CSS class for the save button.
	 * Platform-specific: Web uses "btn-primary-minimal", Extension uses "btn-primary".
	 * @default "btn-primary"
	 */
	buttonClass?: string;
	/**
	 * Optional error message key for missing URL error.
	 * Platform-specific: Web uses "PleaseEnterRecipeUrl", Extension uses "NoUrlFound".
	 */
	noUrlErrorKey?: ErrorMessageKey;
	/**
	 * Optional text size for status messages.
	 * Platform-specific: Extension may use TextSize.Xs for compact popup.
	 * @default undefined (uses default StatusMessage size)
	 */
	statusTextSize?: (typeof TextSize)[keyof typeof TextSize];
};

/**
 * RecipeFormShell component.
 *
 * Shared shell for recipe save forms. Manages save state, API key prompts,
 * progress tracking, and error handling. Platform-specific components provide
 * URL source and success handling via props.
 *
 * @param props - Component props.
 */
export function RecipeFormShell(props: RecipeFormShellProps) {
	const { storage } = useStorage();
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
		getApiUrl: props.getApiUrl,
		getCurrentUrl: props.getCurrentUrl,
		setStatus,
		setLoading,
		setProgress,
		onSuccess: (result) => {
			// Call parent's onSuccess to get status message and perform side effects
			const statusToSet = props.onSuccess(result);
			setStatus(statusToSet);
		},
		onComplete: props.onComplete,
		onDuplicate: props.onDuplicate
			? (notionUrl) => {
					// Call parent's onDuplicate to get status message
					const statusToSet = props.onDuplicate?.(notionUrl);
					if (statusToSet) {
						setStatus(statusToSet);
					}
				}
			: undefined,
		noUrlErrorKey: props.noUrlErrorKey,
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

	// Expose internal handlers for platform-specific integrations (e.g., query params)
	// Called synchronously during component setup
	props.onShellReady?.({
		performSave,
		setPendingSave,
		setShowApiPrompt,
	});

	return (
		<div class="flex flex-col gap-3">
			{props.urlSource}

			<button
				id="save-button"
				type="button"
				onClick={handleSave}
				disabled={loading() || isInvalidApiKey()}
				class={props.buttonClass || "btn-primary group"}
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
						<StatusMessage message={s().message} type={s().type} textSize={props.statusTextSize}>
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
