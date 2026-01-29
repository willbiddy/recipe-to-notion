/**
 * StatusMessage - Component for displaying status messages with icons.
 *
 * Renders info, success, or error messages with appropriate styling and icons.
 * Supports both plain text and HTML content, as well as JSX children.
 * Automatically applies ARIA live region attributes for accessibility.
 *
 * Features:
 * - Three status types: info (blue), success (green), error (red)
 * - Configurable text size (xs, sm, base)
 * - HTML rendering support (innerHTML) when message contains HTML tags
 * - JSX children support (takes precedence over message prop)
 * - Accessible with aria-live="polite" for screen readers
 * - Fade-in animation
 *
 * @example
 * ```tsx
 * // Simple text message
 * <StatusMessage
 *   message="Recipe saved successfully!"
 *   type={StatusType.Success}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // HTML message with link
 * <StatusMessage
 *   message='Recipe exists. <a href="..." class="underline">Open in Notion</a>'
 *   type={StatusType.Info}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // JSX children
 * <StatusMessage type={StatusType.Error}>
 *   <>
 *     Failed to save. <button onClick={retry}>Retry</button>
 *   </>
 * </StatusMessage>
 * ```
 */

import type { JSX } from "solid-js";
import { Show } from "solid-js";

/**
 * Status types for status messages.
 * Determines the icon, color scheme, and semantic meaning.
 */
export enum StatusType {
	Info = "info",
	Success = "success",
	Error = "error",
}

/**
 * Text size options for status messages.
 * Controls the font size of the message text.
 */
export enum TextSize {
	Xs = "xs",
	Sm = "sm",
	Base = "base",
}

/**
 * Props for StatusMessage component.
 */
export type StatusMessageProps = {
	/**
	 * The status message to display. Can contain HTML (will use innerHTML).
	 * If children are provided, message is ignored.
	 */
	message?: string;
	/**
	 * JSX children to display instead of message.
	 * Takes precedence over message prop.
	 */
	children?: JSX.Element;
	/**
	 * The type of status (info, success, or error).
	 * Defaults to StatusType.Info if not provided.
	 */
	type?: StatusType;
	/**
	 * Optional text size (xs, sm, base).
	 * Defaults to TextSize.Sm if not provided.
	 */
	textSize?: TextSize;
	/**
	 * Optional custom base classes to override default styling.
	 */
	baseClasses?: string;
};

/**
 * Gets the icon SVG for a status type.
 *
 * @param type - The status type (info, success, or error).
 * @returns JSX element containing the appropriate SVG icon.
 */
function getStatusIcon(type: StatusType) {
	if (type === StatusType.Info) {
		return (
			<svg
				class="w-5 h-5 flex-shrink-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		);
	}
	if (type === StatusType.Success) {
		return (
			<svg
				class="w-5 h-5 flex-shrink-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		);
	}
	return (
		<svg
			class="w-5 h-5 flex-shrink-0"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}

/**
 * StatusMessage component for displaying status messages.
 *
 * @param props - Component props.
 * @param props.message - Optional message text (can include HTML).
 * @param props.children - Optional JSX children.
 * @param props.type - Status type (info, success, error).
 * @param props.textSize - Text size (xs, sm, base).
 * @param props.baseClasses - Custom base classes.
 */
export function StatusMessage(props: StatusMessageProps) {
	const textSize = () => props.textSize ?? TextSize.Sm;
	const type = () => props.type ?? StatusType.Info;

	const getTextSizeClass = () => {
		const size = textSize();
		if (size === TextSize.Xs) return "text-xs";
		if (size === TextSize.Base) return "text-base";
		return "text-sm";
	};

	const getTypeClass = () => {
		const statusType = type();
		if (statusType === StatusType.Success) return "status-success-minimal";
		if (statusType === StatusType.Error) return "status-error-minimal";
		return "status-info-minimal";
	};

	const baseClasses = () =>
		props.baseClasses ||
		`py-2 leading-relaxed animate-[fadeIn_0.2s_ease-in] block ${getTextSizeClass()}`;

	const isHTML = () => (props.message?.includes("<") && props.message?.includes(">")) ?? false;
	const hasChildren = () => props.children !== undefined;
	const hasMessage = () => props.message !== undefined;

	const isError = () => type() === StatusType.Error;
	const iconColorClass = () => (isError() ? "text-red-600" : "");
	const textColorClass = () => (isError() ? "text-red-600" : "");
	return (
		<output class={`${baseClasses()} ${getTypeClass()}`} aria-live="polite" aria-atomic="true">
			<div class="flex items-start gap-2">
				<div class="flex-shrink-0">
					<div class={iconColorClass()}>{getStatusIcon(type())}</div>
				</div>
				<div class="flex-1">
					<Show
						when={hasChildren()}
						fallback={
							<Show
								when={hasMessage() && isHTML()}
								fallback={
									<Show when={hasMessage()}>
										<span class={textColorClass()}>{props.message}</span>
									</Show>
								}
							>
								<span class={textColorClass()} innerHTML={props.message} />
							</Show>
						}
					>
						<span class={textColorClass()}>{props.children}</span>
					</Show>
				</div>
			</div>
		</output>
	);
}
