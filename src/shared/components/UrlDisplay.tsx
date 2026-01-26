/**
 * UrlDisplay component for showing the current page URL/title.
 * Used in the browser extension popup.
 * Displays recipe title prominently with source (author or website) as secondary text.
 */

export type UrlDisplayProps = {
	/** The URL to display. */
	url: string | null;
	/** The page title or recipe title (optional). */
	title: string | null;
	/** The source (author or website name) to display as secondary text (optional). */
	source: string | null;
};

/**
 * UrlDisplay component shows the recipe title with source, or falls back to URL/title.
 */
export function UrlDisplay(props: UrlDisplayProps) {
	const hasValidUrl =
		props.url && (props.url.startsWith("http://") || props.url.startsWith("https://"));
	const hasTitle = props.title?.trim();
	const hasSource = props.source?.trim();

	// Error state
	if (!props.url || !hasValidUrl) {
		return (
			<div
				class="text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center"
				title={props.url || undefined}
			>
				{props.url ? "Not a valid web page" : "No URL found"}
			</div>
		);
	}

	// Recipe title with source (preferred display)
	if (hasTitle && hasSource) {
		return (
			<div
				class="p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem]"
				title={props.url || undefined}
			>
				<div class="text-sm font-semibold text-gray-900 mb-1">{props.title}</div>
				<div class="text-xs text-gray-500">{props.source}</div>
			</div>
		);
	}

	// Just title (no source)
	if (hasTitle) {
		return (
			<div
				class="text-sm text-gray-700 p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] flex items-center"
				title={props.url || undefined}
			>
				{props.title}
			</div>
		);
	}

	// Fallback to URL
	try {
		const urlObj = new URL(props.url);
		const displayUrl = `${urlObj.hostname}${urlObj.pathname}`;
		return (
			<div
				class="text-[14px] text-gray-700 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-accent-50 hover:border-primary-300 shadow-sm min-h-[3rem] flex items-center"
				title={props.url || undefined}
			>
				{displayUrl}
			</div>
		);
	} catch {
		return (
			<div
				class="text-sm text-gray-600 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center"
				title={props.url || undefined}
			>
				{props.url}
			</div>
		);
	}
}
