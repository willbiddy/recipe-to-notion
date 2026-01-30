import type { JSX } from "solid-js";

/**
 * Props for NotionLinkButton component.
 */
export type NotionLinkButtonProps = {
	/**
	 * The Notion URL to open when clicked. If not provided, button is disabled.
	 */
	notionUrl?: string;
	/**
	 * Optional click handler. If not provided, opens in new tab via chrome.tabs API (extension)
	 * or window.open (web).
	 */
	onClick?: () => void;
	/**
	 * Optional CSS class for styling.
	 */
	class?: string;
};

/**
 * Button component for opening recipes in Notion.
 *
 * Used in success and duplicate messages across extension and web forms.
 *
 * @example
 * ```tsx
 * <NotionLinkButton notionUrl={result.notionUrl} />
 * ```
 */
export function NotionLinkButton(props: NotionLinkButtonProps): JSX.Element {
	const hasUrl = () => !!props.notionUrl;

	const handleClick = () => {
		const url = props.notionUrl;
		if (!url) return;

		if (props.onClick) {
			props.onClick();
		} else if (typeof chrome !== "undefined" && chrome.tabs) {
			// Extension context - use chrome.tabs API
			chrome.tabs.create({ url });
		} else {
			// Web context - use standard window.open
			window.open(url, "_blank", "noopener,noreferrer");
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={!hasUrl()}
			class={
				props.class ||
				"underline font-semibold bg-transparent border-none p-0 cursor-pointer text-inherit hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
			}
		>
			Open in Notion
		</button>
	);
}
