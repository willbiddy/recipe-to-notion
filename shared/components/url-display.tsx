/**
 * UrlDisplay - Component for displaying the current page URL/title in extension.
 *
 * Shows the current page information in the extension popup with smart fallback logic:
 * 1. Best: Recipe title + author (e.g., "Chocolate Chip Cookies" by "Sally's Baking")
 * 2. Good: Recipe title only (e.g., "Chocolate Chip Cookies")
 * 3. Fallback: Hostname + pathname (e.g., "allrecipes.com/recipe/10813/...")
 * 4. Error: Invalid/unsupported URL with helpful message
 *
 * Features:
 * - Smart display priority (title+author > title > hostname+path > URL)
 * - Error state for invalid URLs (chrome://, file://, etc.)
 * - Permission issue detection and messaging
 * - URL tooltip on hover (shows full URL)
 * - Responsive styling with hover effects
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <UrlDisplay
 *   url="https://allrecipes.com/recipe/12345"
 *   title="Best Chocolate Chip Cookies"
 *   source="Sally Baker"
 *   permissionIssue={false}
 * />
 * ```
 */

import { getUnsupportedUrlMessage, isValidHttpUrl } from "@shared/url-utils";
import { createMemo, Show } from "solid-js";

/**
 * Props for UrlDisplay component.
 */
export type UrlDisplayProps = {
	/**
	 * The URL to display. Should be a valid HTTP(S) URL.
	 * Null or invalid URLs will show error state.
	 */
	url: string | null;
	/**
	 * The page title or recipe title (optional).
	 * When present, displays prominently instead of URL.
	 */
	title: string | null;
	/**
	 * The source (author or website name) to display as secondary text (optional).
	 * Shows below title when both title and source are present.
	 */
	source: string | null;
	/**
	 * Whether the issue is due to missing permissions (optional).
	 * Customizes error message to guide user on fixing permission issues.
	 */
	permissionIssue?: boolean;
};

/**
 * Displays the recipe title with source, or falls back to URL/title.
 *
 * Uses createMemo for reactive derived values and implements smart display
 * priority based on available data (title+source > title > hostname+path > raw URL).
 *
 * @param props - Component props.
 * @param props.url - The URL to display.
 * @param props.title - Optional page/recipe title.
 * @param props.source - Optional source (author/website).
 * @param props.permissionIssue - Whether error is permission-related.
 */
export function UrlDisplay(props: UrlDisplayProps) {
	// Use createMemo for reactive derived values
	const hasValidUrl = createMemo(() => {
		return props.url && isValidHttpUrl(props.url);
	});

	const hasTitle = createMemo(() => props.title?.trim());
	const hasSource = createMemo(() => props.source?.trim());

	// Helper to parse URL reactively
	const parsedUrl = createMemo(() => {
		if (!props.url) return null;
		try {
			const urlObj = new URL(props.url);
			return {
				hostname: urlObj.hostname,
				pathname: urlObj.pathname,
			};
		} catch {
			return null;
		}
	});

	return (
		<Show
			when={hasValidUrl()}
			fallback={
				<div
					class="text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center dark:bg-error-900/20 dark:text-error-400 dark:border-error-800"
					title={props.url || undefined}
				>
					{getUnsupportedUrlMessage(props.url, props.permissionIssue)}
				</div>
			}
		>
			<Show
				when={hasTitle() && hasSource()}
				fallback={
					<Show
						when={hasTitle()}
						fallback={
							<Show
								when={parsedUrl()}
								fallback={
									<div
										class="text-sm text-gray-600 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center dark:bg-gray-800 dark:text-gray-400"
										title={props.url || undefined}
									>
										{props.url}
									</div>
								}
							>
								{(url) => (
									<div
										class="text-[14px] text-gray-700 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-accent-50 hover:border-primary-300 shadow-sm min-h-[3rem] flex items-center dark:bg-accent-900/20 dark:text-gray-300"
										title={props.url || undefined}
									>
										{url().hostname}
										{url().pathname}
									</div>
								)}
							</Show>
						}
					>
						<div
							class="text-sm text-gray-700 p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] flex items-center dark:bg-gray-800 dark:text-gray-300"
							title={props.url || undefined}
						>
							{props.title}
						</div>
					</Show>
				}
			>
				<div
					class="p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] dark:bg-gray-800 dark:border-primary-800"
					title={props.url || undefined}
				>
					<div class="text-sm font-semibold text-gray-900 mb-1 dark:text-gray-100">
						{props.title}
					</div>
					<div class="text-xs text-gray-500 dark:text-gray-400">{props.source}</div>
				</div>
			</Show>
		</Show>
	);
}
