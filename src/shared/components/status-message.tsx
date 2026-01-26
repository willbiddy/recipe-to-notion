/**
 * StatusMessage component for displaying status messages.
 * Replaces the updateStatus/clearStatus utility functions.
 */

import { Show } from "solid-js";

/**
 * Status types for status messages.
 */
export enum StatusType {
	Info = "info",
	Success = "success",
	Error = "error",
}

/**
 * Text size options for status messages.
 */
export enum TextSize {
	Xs = "xs",
	Sm = "sm",
	Base = "base",
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

	const isHTML = () => props.message.includes("<") && props.message.includes(">");

	const isError = () => type() === StatusType.Error;
	const iconColorClass = () => (isError() ? "text-red-600" : "");
	const textColorClass = () => (isError() ? "text-red-600" : "");
	const alignmentClass = () => (isError() ? "items-center justify-center" : "items-start");

	return (
		<output class={`${baseClasses()} ${getTypeClass()}`} aria-live="polite" aria-atomic="true">
			<div class={`flex ${alignmentClass()} gap-2`}>
				<div class={`flex-shrink-0 ${isError() ? "" : "mt-0.5"}`}>
					<div class={iconColorClass()}>{getStatusIcon(type())}</div>
				</div>
				<div class={isError() ? "" : "flex-1"}>
					<Show when={isHTML()} fallback={<span class={textColorClass()}>{props.message}</span>}>
						<span class={textColorClass()} innerHTML={props.message} />
					</Show>
				</div>
			</div>
		</output>
	);
}
