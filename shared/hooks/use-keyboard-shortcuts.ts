import { onCleanup, onMount } from "solid-js";

/**
 * Options for keyboard shortcut handling.
 */
export type KeyboardShortcutsOptions = {
	/**
	 * Callback when Enter key is pressed.
	 */
	onEnter?: () => void;
	/**
	 * Callback when Escape key is pressed.
	 */
	onEscape?: () => void;
	/**
	 * Whether to prevent default behavior for handled keys. Default: true
	 */
	preventDefault?: boolean;
};

/**
 * Hook for handling keyboard shortcuts (Enter and Escape keys).
 *
 * @param options - Configuration for keyboard shortcuts.
 * @returns Object with setup function to attach to an element.
 *
 * @example
 * ```tsx
 * const { onKeyDown } = useKeyboardShortcuts({
 *   onEnter: () => handleSave(),
 *   onEscape: () => handleCancel(),
 * });
 *
 * return <input onKeyDown={onKeyDown} />;
 * ```
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
	const { onEnter, onEscape, preventDefault = true } = options;

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && onEnter) {
			if (preventDefault) {
				e.preventDefault();
			}
			onEnter();
		} else if (e.key === "Escape" && onEscape) {
			if (preventDefault) {
				e.preventDefault();
			}
			onEscape();
		}
	}

	return { onKeyDown };
}

/**
 * Options for global keyboard shortcut handling.
 */
export type GlobalKeyboardShortcutsOptions = KeyboardShortcutsOptions & {
	/**
	 * Whether shortcuts are enabled. Default: true
	 */
	enabled?: boolean;
};

/**
 * Hook for handling global keyboard shortcuts (attached to document).
 *
 * @param options - Configuration for global keyboard shortcuts.
 *
 * @example
 * ```tsx
 * useGlobalKeyboardShortcuts({
 *   onEscape: () => closeModal(),
 *   enabled: isModalOpen,
 * });
 * ```
 */
export function useGlobalKeyboardShortcuts(options: GlobalKeyboardShortcutsOptions) {
	const { onEnter, onEscape, preventDefault = true, enabled = true } = options;

	onMount(() => {
		if (!enabled) return;

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Enter" && onEnter) {
				if (preventDefault) {
					e.preventDefault();
				}
				onEnter();
			} else if (e.key === "Escape" && onEscape) {
				if (preventDefault) {
					e.preventDefault();
				}
				onEscape();
			}
		}

		document.addEventListener("keydown", handleKeyDown);

		onCleanup(() => {
			document.removeEventListener("keydown", handleKeyDown);
		});
	});
}
