/**
 * Shared type guard utilities for type checking throughout the codebase.
 * Use these instead of direct typeof/instanceof checks for consistency.
 */

/**
 * Type guard that returns true if value is a non-null object.
 *
 * @param value - The value to check.
 * @returns True if value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Type guard that returns true if value is an object with the specified property.
 *
 * @param value - The value to check.
 * @param key - The property key to check for.
 * @returns True if value is an object containing the specified key.
 */
export function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
	return isObject(value) && key in value;
}

/**
 * Type guard that returns true if value is a string.
 *
 * @param value - The value to check.
 * @returns True if value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Type guard that returns true if value is a non-empty string.
 *
 * @param value - The value to check.
 * @returns True if value is a string and not empty (after trimming).
 */
export function isNonEmptyString(value: unknown): value is string {
	return isString(value) && value.trim() !== "";
}

/**
 * Type guard that returns true if value is an array.
 *
 * @param value - The value to check.
 * @returns True if value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

/**
 * Type guard that returns true if value is an Error instance.
 *
 * @param value - The value to check.
 * @returns True if value is an Error.
 */
export function isError(value: unknown): value is Error {
	return value instanceof Error;
}

/**
 * Type guard that returns true if value is a number.
 *
 * @param value - The value to check.
 * @returns True if value is a number.
 */
export function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Type guard that returns true if value is a boolean.
 *
 * @param value - The value to check.
 * @returns True if value is a boolean.
 */
export function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

/**
 * Type guard that returns true if value is null or undefined.
 *
 * @param value - The value to check.
 * @returns True if value is null or undefined.
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

/**
 * Type guard that returns true if value is not null or undefined.
 *
 * @param value - The value to check.
 * @returns True if value is not null or undefined.
 */
export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
