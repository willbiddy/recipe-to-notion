/**
 * UrlDisplay component for showing the current page URL/title.
 *
 * Displays recipe title prominently with source (author or website) as secondary text.
 * Used in the browser extension popup.
 */

import { getUnsupportedUrlMessage, isValidHttpUrl } from "../url-utils.js";

export type UrlDisplayProps = {
	/** The URL to display. */
	url: string | null;
	/** The page title or recipe title (optional). */
	title: string | null;
	/** The source (author or website name) to display as secondary text (optional). */
	source: string | null;
};

/**
 * Displays the recipe title with source, or falls back to URL/title.
 *
 * @param props - Component props containing URL, title, and source.
 */
export function UrlDisplay(props: UrlDisplayProps) {
	console.log("[UrlDisplay] Props received:", {
		url: props.url,
		urlType: typeof props.url,
		title: props.title,
		source: props.source,
	});

	const hasValidUrl = props.url && isValidHttpUrl(props.url);
	const hasTitle = props.title?.trim();
	const hasSource = props.source?.trim();

	console.log("[UrlDisplay] Validation results:", {
		hasValidUrl,
		hasTitle: !!hasTitle,
		hasSource: !!hasSource,
	});

	if (!props.url || !hasValidUrl) {
		const errorMessage = getUnsupportedUrlMessage(props.url);
		console.log("[UrlDisplay] Showing error - URL invalid or missing", {
			hasUrl: !!props.url,
			hasValidUrl,
			errorMessage,
		});
		return (
			<div
				class="text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center dark:bg-error-900/20 dark:text-error-400 dark:border-error-800"
				title={props.url || undefined}
			>
				{errorMessage}
			</div>
		);
	}

	if (hasTitle && hasSource) {
		return (
			<div
				class="p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] dark:bg-gray-800 dark:border-primary-800"
				title={props.url || undefined}
			>
				<div class="text-sm font-semibold text-gray-900 mb-1 dark:text-gray-100">{props.title}</div>
				<div class="text-xs text-gray-500 dark:text-gray-400">{props.source}</div>
			</div>
		);
	}

	if (hasTitle) {
		return (
			<div
				class="text-sm text-gray-700 p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] flex items-center dark:bg-gray-800 dark:text-gray-300"
				title={props.url || undefined}
			>
				{props.title}
			</div>
		);
	}

	try {
		const urlObj = new URL(props.url);
		const displayUrl = `${urlObj.hostname}${urlObj.pathname}`;
		return (
			<div
				class="text-[14px] text-gray-700 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-accent-50 hover:border-primary-300 shadow-sm min-h-[3rem] flex items-center dark:bg-accent-900/20 dark:text-gray-300"
				title={props.url || undefined}
			>
				{displayUrl}
			</div>
		);
	} catch {
		return (
			<div
				class="text-sm text-gray-600 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center dark:bg-gray-800 dark:text-gray-400"
				title={props.url || undefined}
			>
				{props.url}
			</div>
		);
	}
}
