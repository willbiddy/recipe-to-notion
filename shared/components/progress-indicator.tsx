/**
 * ProgressIndicator - Component for displaying real-time progress messages.
 *
 * Shows a progress message during async operations (e.g., "Scraping recipe...",
 * "Analyzing with AI...", "Saving to Notion..."). Includes fade-in animation
 * and accessible ARIA live region for screen readers.
 *
 * Replaces the legacy showProgress/hideProgress utility functions with a
 * component-based approach.
 *
 * @example
 * ```tsx
 * <Show when={progress()}>
 *   {(msg) => <ProgressIndicator message={msg()} />}
 * </Show>
 * ```
 *
 * @example
 * ```tsx
 * // Used in recipe save flow
 * setProgress("Scraping recipe...");
 * // Later:
 * setProgress("Analyzing with AI...");
 * // Finally:
 * setProgress(null); // Hides the progress indicator
 * ```
 */

/**
 * Props for ProgressIndicator component.
 */
export type ProgressIndicatorProps = {
	/**
	 * The progress message to display (e.g., "Scraping recipe...", "Saving to Notion...").
	 */
	message: string;
};

/**
 * ProgressIndicator component for displaying progress with accessible output.
 *
 * @param props - Component props.
 * @param props.message - Progress message to display.
 */
export function ProgressIndicator(props: ProgressIndicatorProps) {
	return (
		<output
			class="flex items-center gap-2 py-2 text-sm text-primary-600 dark:text-primary-400 animate-[fadeIn_0.2s_ease-in]"
			aria-live="polite"
			aria-atomic="true"
		>
			<div class="font-medium">{props.message}</div>
		</output>
	);
}
