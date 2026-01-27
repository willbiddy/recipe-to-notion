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
			class="flex items-center gap-2 py-2 text-sm text-primary-600 dark:text-primary-400 animate-[fadeIn_0.2s_ease-in]"
			aria-live="polite"
			aria-atomic="true"
		>
			<div
				class="spinner w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin flex-shrink-0 dark:border-gray-700 dark:border-t-primary-400"
				aria-hidden="true"
			/>
			<div class="font-medium">{props.message}</div>
		</output>
	);
}
