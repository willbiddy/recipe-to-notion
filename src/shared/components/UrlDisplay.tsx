/**
 * UrlDisplay component for showing the current page URL/title.
 * Used in the browser extension popup.
 */

export type UrlDisplayProps = {
	/** The URL to display. */
	url: string | null;
	/** The page title (optional). */
	title: string | null;
};

/**
 * UrlDisplay component shows the current page URL or title.
 */
export function UrlDisplay(props: UrlDisplayProps) {
	const getDisplayText = () => {
		if (!props.url) {
			return "No URL found";
		}

		if (!props.url.startsWith("http://") && !props.url.startsWith("https://")) {
			return "Not a valid web page";
		}

		const trimmedTitle = props.title?.trim();
		if (trimmedTitle) {
			return trimmedTitle;
		}

		try {
			const urlObj = new URL(props.url);
			return `${urlObj.hostname}${urlObj.pathname}`;
		} catch {
			return props.url;
		}
	};

	const getClasses = () => {
		if (!props.url) {
			return "text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center";
		}

		if (!props.url.startsWith("http://") && !props.url.startsWith("https://")) {
			return "text-sm text-error-600 p-3.5 bg-error-50 border-2 border-error-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left min-h-[3rem] flex items-center";
		}

		if (props.title?.trim()) {
			return "text-sm text-gray-700 p-3.5 bg-white border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 text-left hover:border-primary-300 min-h-[3rem] flex items-center";
		}

		return "text-[14px] text-gray-700 p-3.5 bg-accent-50/60 border-2 border-primary-200 rounded-2xl break-words leading-relaxed transition-all duration-200 font-medium text-left hover:bg-accent-50 hover:border-primary-300 shadow-sm";
	};

	return (
		<div class={getClasses()} title={props.url || undefined}>
			{getDisplayText()}
		</div>
	);
}
