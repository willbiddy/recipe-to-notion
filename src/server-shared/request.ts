/**
 * Generates a unique request correlation ID.
 *
 * @returns A unique request ID string.
 */
export function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
