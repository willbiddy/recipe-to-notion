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

	async function saveSecret() {
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
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			saveSecret();
		}
		if (e.key === "Escape" && props.onCancel) {
			props.onCancel();
		}
	}

	function handleBackdropKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape" && props.onCancel) {
			props.onCancel();
		}
	}

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
				class="bg-white rounded-2xl shadow-xl p-6 w-[360px]"
				role="document"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<h3 id="api-secret-title" class="text-lg font-semibold text-gray-900 mb-2">
					API Secret Required
				</h3>
				<p class="text-sm text-gray-600 mb-4">Enter your API secret to save recipes.</p>
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
					<div class="flex flex-col gap-3" style="flex-direction: column;">
						<button
							type="button"
							onClick={saveSecret}
							class="w-full px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors duration-200"
						>
							Save
						</button>
						<Show when={props.onCancel}>
							<button
								type="button"
								onClick={props.onCancel}
								class="w-full px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-200"
							>
								Cancel
							</button>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
}
