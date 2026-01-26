/**
 * StatusMessage component for displaying status messages.
 * Replaces the updateStatus/clearStatus utility functions.
 */

import { Show } from "solid-js";

/**
 * Status types for status messages.
 */
export enum StatusType {
	INFO = "info",
	SUCCESS = "success",
	ERROR = "error",
}

/**
 * Text size options for status messages.
 */
export enum TextSize {
	XS = "xs",
	SM = "sm",
	BASE = "base",
}

export type StatusMessageProps = {
	/** The status message to display. Can contain HTML. */
	message: string;
	/** The type of status (info, success, or error). */
	type?: StatusType;
	/** Optional text size. */
	textSize?: TextSize;
	/** Optional custom base classes. */
	baseClasses?: string;
};

/**
 * Gets the icon SVG for a status type.
 */
function getStatusIcon(type: StatusType) {
	if (type === StatusType.INFO) {
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
	if (type === StatusType.SUCCESS) {
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
 */
export function StatusMessage(props: StatusMessageProps) {
	const textSize = () => props.textSize ?? TextSize.SM;
	const type = () => props.type ?? StatusType.INFO;

	const getTextSizeClass = () => {
		const size = textSize();
		if (size === TextSize.XS) return "text-xs";
		if (size === TextSize.BASE) return "text-base";
		return "text-sm";
	};

	const getTypeClass = () => {
		const statusType = type();
		if (statusType === StatusType.SUCCESS) return "status-success";
		if (statusType === StatusType.ERROR) return "status-error";
		return "status-info";
	};

	const baseClasses = () =>
		props.baseClasses ||
		`py-4 px-5 rounded-2xl leading-relaxed animate-[fadeIn_0.2s_ease-in] block shadow-sm ${getTextSizeClass()}`;

	const isHTML = () => props.message.includes("<") && props.message.includes(">");

	return (
		<output class={`${baseClasses()} ${getTypeClass()}`} aria-live="polite" aria-atomic="true">
			<div class="flex items-start gap-3">
				{getStatusIcon(type())}
				<div class="flex-1">
					<Show when={isHTML()} fallback={<span>{props.message}</span>}>
						<span innerHTML={props.message} />
					</Show>
				</div>
			</div>
		</output>
	);
}
