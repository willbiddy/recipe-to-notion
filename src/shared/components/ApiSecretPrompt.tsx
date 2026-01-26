/**
 * Simple prompt component for entering API secret when needed.
 */

import { createSignal, Show } from "solid-js";
import { createStorageAdapter } from "../storage.js";

export type ApiSecretPromptProps = {
	/** Callback when secret is saved */
	onSecretSaved: () => void;
	/** Callback to cancel */
	onCancel?: () => void;
};

/**
 * ApiSecretPrompt component for collecting API secret.
 */
export function ApiSecretPrompt(props: ApiSecretPromptProps) {
	const storage = createStorageAdapter();
	const [secret, setSecret] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);

	/**
	 * Saves the API secret.
	 */
	const saveSecret = async () => {
		const key = secret().trim();
		if (!key) {
			setError("API secret cannot be empty");
			return;
		}

		try {
			await storage.saveApiKey(key);
			setError(null);
			props.onSecretSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save API secret");
		}
	};

	/**
	 * Handles Enter key press.
	 */
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			saveSecret();
		}
		if (e.key === "Escape" && props.onCancel) {
			props.onCancel();
		}
	};

	const handleBackdropKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && props.onCancel) {
			props.onCancel();
		}
	};

	return (
		<div
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="api-secret-title"
			onClick={props.onCancel}
			onKeyDown={handleBackdropKeyDown}
		>
			<div
				class="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full"
				role="document"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<h3 id="api-secret-title" class="text-lg font-semibold text-gray-900 mb-2">
					API Secret Required
				</h3>
				<p class="text-sm text-gray-600 mb-4">
					Enter your API secret to save recipes. Get this from your Vercel deployment's{" "}
					<code class="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
						API_SECRET
					</code>{" "}
					environment variable.
				</p>
				<div class="space-y-3">
					<div class="relative">
						<input
							type="password"
							value={secret()}
							onInput={(e) => {
								setSecret((e.target as HTMLInputElement).value);
								setError(null);
							}}
							onKeyDown={handleKeyDown}
							placeholder="Enter your API secret"
							autocomplete="off"
							class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
							autofocus
						/>
					</div>
					<Show when={error()}>
						<p class="text-sm text-red-600">{error()}</p>
					</Show>
					<div class="flex gap-3">
						<Show when={props.onCancel}>
							<button
								type="button"
								onClick={props.onCancel}
								class="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-200"
							>
								Cancel
							</button>
						</Show>
						<button
							type="button"
							onClick={saveSecret}
							class="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors duration-200"
						>
							Save
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
