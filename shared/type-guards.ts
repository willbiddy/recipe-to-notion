/**
 * Shared type guard utilities for type checking throughout the codebase.
 *
 * Type guards provide runtime type checking with TypeScript type narrowing.
 * Use these instead of direct typeof/instanceof checks for consistency and
 * better type inference.
 *
 * All type guards follow the pattern: `value is Type` to enable TypeScript's
 * control flow analysis.
 *
 * @example
 * ```ts
 * function processData(data: unknown) {
 *   if (isObject(data) && hasProperty(data, 'name') && isString(data.name)) {
 *     // TypeScript knows data.name is a string here
 *     console.log(data.name.toUpperCase());
 *   }
 * }
 * ```
 */

/**
 * Type guard that returns true if value is a non-null object.
 *
 * Note: Arrays are objects in JavaScript, so this returns true for arrays.
 * Use isArray() if you need to distinguish between objects and arrays.
 *
 * @param value - The value to check.
 * @returns True if value is a non-null object.
 *
 * @example
 * ```ts
 * isObject({}) // true
 * isObject([]) // true (arrays are objects)
 * isObject(null) // false
 * isObject("string") // false
 * isObject(undefined) // false
 * ```
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Type guard that returns true if value is an object with the specified property.
 *
 * Useful for safely accessing properties on unknown values.
 * Enables TypeScript to narrow the type to include the specified property.
 *
 * @param value - The value to check.
 * @param key - The property key to check for.
 * @returns True if value is an object containing the specified key.
 *
 * @example
 * ```ts
 * function processError(error: unknown) {
 *   if (hasProperty(error, 'message') && isString(error.message)) {
 *     console.log(error.message); // TypeScript knows error.message exists and is a string
 *   }
 * }
 * ```
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
