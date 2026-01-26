/**
 * ProgressIndicator component for displaying progress messages.
 * Replaces the showProgress/hideProgress utility functions.
 */

export type ProgressIndicatorProps = {
	/** The progress message to display. */
	message: string;
};

/**
 * ProgressIndicator component for displaying progress with spinner.
 */
export function ProgressIndicator(props: ProgressIndicatorProps) {
	return (
		<output
			class="flex items-center gap-3 py-4 px-5 bg-gradient-to-r from-primary-50 to-accent-50 border-2 border-primary-200 rounded-2xl animate-[fadeIn_0.2s_ease-in] shadow-sm"
			aria-live="polite"
			aria-atomic="true"
		>
			<div
				class="spinner w-5 h-5 border-[3px] border-primary-100 border-t-primary-600 rounded-full animate-spin flex-shrink-0"
				aria-hidden="true"
			/>
			<div class="text-base text-primary-900 font-medium">{props.message}</div>
		</output>
	);
}
