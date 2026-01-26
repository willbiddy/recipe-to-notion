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
	/** Optional function to close the settings panel. */
	onClose?: () => void;
	/** Optional callback when API key is successfully saved. */
	onApiKeySaved?: () => void;
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

	async function loadApiKey() {
		const key = await storage.getApiKey();
		setApiKey(key || "");
	}

	async function saveApiKey() {
		const key = apiKey().trim();
		if (!key) {
			setApiKeyStatus({ message: "API secret cannot be empty", type: StatusType.Error });
			return;
		}

		try {
			await storage.saveApiKey(key);
			setApiKeyStatus({ message: "API secret saved successfully", type: StatusType.Success });
			if (props.onApiKeySaved) {
				props.onApiKeySaved();
			}
			setTimeout(() => {
				setApiKeyStatus(null);
			}, SUCCESS_STATUS_CLEAR_DELAY_MS);
		} catch (error) {
			setApiKeyStatus({
				message: error instanceof Error ? error.message : "Failed to save API secret",
				type: StatusType.Error,
			});
		}
	}

	function toggleApiKeyVisibility() {
		setApiKeyVisible(!apiKeyVisible());
	}

	onMount(() => {
		loadApiKey();
	});

	const panelClass = () => props.panelClass || "flex flex-col gap-6 pt-6 mt-6";
	const helpTextClass = () => props.helpTextClass || "text-base text-primary-900 leading-relaxed";

	return (
		<div id="settings-panel" class={panelClass()}>
			<h3 class="text-sm font-medium text-gray-900 mb-3">API Secret</h3>
			<div class="flex flex-col gap-3">
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
					<code class="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
						API_SECRET
					</code>{" "}
					environment variable. Stored locally and never shared.
				</p>
			</div>
			<button
				type="button"
				onClick={saveApiKey}
				aria-label="Save API secret"
				class="w-full px-4 py-2.5 bg-primary-600 text-white border-none rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-primary-700 active:bg-primary-800 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2"
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
				Save
			</button>
			<Show when={apiKeyStatus()}>
				{(status) => (
					<StatusMessage
						message={status().message}
						type={status().type}
						textSize={props.textSize || TextSize.Sm}
					/>
				)}
			</Show>
		</div>
	);
}
