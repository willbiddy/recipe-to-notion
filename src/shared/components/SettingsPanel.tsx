/**
 * SettingsPanel component for managing API key.
 * Shared between web and extension interfaces.
 */

import { createSignal, onMount, Show } from "solid-js";
import { createStorageAdapter } from "../storage.js";
import { StatusMessage, StatusType, TextSize } from "./StatusMessage.js";

export type SettingsPanelProps = {
	/** Text size for status messages. */
	textSize?: TextSize;
	/** Custom class for the panel container. */
	panelClass?: string;
	/** Custom class for the help text. */
	helpTextClass?: string;
};

/**
 * SettingsPanel component for API key management.
 */
export function SettingsPanel(props: SettingsPanelProps) {
	const storage = createStorageAdapter();
	const [apiKey, setApiKey] = createSignal("");
	const [apiKeyVisible, setApiKeyVisible] = createSignal(false);
	const [apiKeyStatus, setApiKeyStatus] = createSignal<{
		message: string;
		type: StatusType;
	} | null>(null);

	const SUCCESS_STATUS_CLEAR_DELAY_MS = 2000;

	/**
	 * Loads API key from storage.
	 */
	const loadApiKey = async () => {
		const key = await storage.getApiKey();
		setApiKey(key || "");
	};

	/**
	 * Saves API key to storage.
	 */
	const saveApiKey = async () => {
		const key = apiKey().trim();
		if (!key) {
			setApiKeyStatus({ message: "API secret cannot be empty", type: StatusType.ERROR });
			return;
		}

		try {
			await storage.saveApiKey(key);
			setApiKeyStatus({ message: "API secret saved successfully", type: StatusType.SUCCESS });
			setTimeout(() => {
				setApiKeyStatus(null);
			}, SUCCESS_STATUS_CLEAR_DELAY_MS);
		} catch (error) {
			setApiKeyStatus({
				message: error instanceof Error ? error.message : "Failed to save API secret",
				type: StatusType.ERROR,
			});
		}
	};

	/**
	 * Toggles API key visibility.
	 */
	const toggleApiKeyVisibility = () => {
		setApiKeyVisible(!apiKeyVisible());
	};

	// Load API key when component mounts
	onMount(() => {
		loadApiKey();
	});

	const panelClass = () =>
		props.panelClass || "flex flex-col gap-6 pt-6 mt-6 border-t-2 border-primary-200";
	const helpTextClass = () => props.helpTextClass || "text-base text-primary-900 leading-relaxed";

	return (
		<div id="settings-panel" class={panelClass()}>
			<div class="flex items-center gap-3 mb-2">
				<svg
					class="w-6 h-6 text-primary-700"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<h3 class="text-xl font-semibold text-primary-900">Settings</h3>
			</div>
			<div class="flex flex-col gap-4">
				<label
					for="api-key-input"
					class="text-lg font-medium text-gray-900 flex items-center gap-3"
				>
					<svg
						class="w-5 h-5 text-gray-700"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
						/>
					</svg>
					API Secret
				</label>
				<div class="relative">
					<input
						type={apiKeyVisible() ? "text" : "password"}
						id="api-key-input"
						name="api-key"
						value={apiKey()}
						onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
						placeholder="Enter your API secret"
						autocomplete="off"
						aria-label="API Secret"
						aria-describedby="api-key-help"
						class="input-field-settings"
					/>
					<button
						type="button"
						onClick={toggleApiKeyVisibility}
						aria-label="Toggle API secret visibility"
						class="absolute right-2 top-1/2 -translate-y-1/2 text-primary-700 hover:text-primary-900 p-1.5 rounded-lg hover:bg-primary-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
						title="Show/Hide API secret"
					>
						<Show
							when={apiKeyVisible()}
							fallback={
								<svg
									id="eye-icon"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							}
						>
							<svg
								id="eye-off-icon"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
								<line x1="1" y1="1" x2="23" y2="23" />
							</svg>
						</Show>
					</button>
				</div>
				<p id="api-key-help" class={helpTextClass()}>
					Get this from your Vercel deployment's{" "}
					<code class="text-base bg-primary-100 px-2 py-1 rounded font-mono text-primary-900">
						API_SECRET
					</code>{" "}
					environment variable. This is stored locally in your browser and never shared.
				</p>
			</div>
			<button
				type="button"
				onClick={saveApiKey}
				aria-label="Save API secret"
				class="btn-primary-sm"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				Save API Secret
			</button>
			<Show when={apiKeyStatus()}>
				{(status) => (
					<StatusMessage
						message={status().message}
						type={status().type}
						textSize={props.textSize || TextSize.SM}
					/>
				)}
			</Show>
			<p class="text-xs text-primary-800 pt-2 border-t border-primary-300">
				<a
					href="https://www.flaticon.com/free-icons/cutlery"
					title="cutlery icons"
					target="_blank"
					rel="noopener noreferrer"
					class="hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
				>
					Cutlery icons created by Freepik - Flaticon
				</a>
			</p>
		</div>
	);
}
