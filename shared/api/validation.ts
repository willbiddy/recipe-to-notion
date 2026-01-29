/**
 * Zod schemas for validating Server-Sent Event (SSE) messages.
 *
 * Validates incoming SSE events from the recipe save endpoint to ensure
 * type safety and catch malformed messages. Uses Zod's discriminated union
 * for efficient type checking based on the event type.
 *
 * Event types:
 * - Progress: Status updates during recipe processing (scraping, AI tagging, Notion save)
 * - Complete: Successful save with recipe data and Notion URL
 * - Error: Save failure with error message and optional Notion URL (for duplicates)
 */

import { z } from "zod";
import { ProgressType } from "../constants.js";
import { type ServerProgressEvent, ServerProgressEventType } from "./types.js";

/**
 * Zod schema for Progress event.
 */
const progressEventSchema = z.object({
	type: z.literal(ServerProgressEventType.Progress),
	message: z.string(),
	progressType: z.enum(ProgressType),
});

/**
 * Zod schema for Complete event.
 */
const completeEventSchema = z.object({
	type: z.literal(ServerProgressEventType.Complete),
	success: z.literal(true),
	pageId: z.string(),
	notionUrl: z.string(),
	recipe: z
		.object({
			name: z.string(),
			author: z.string(),
			ingredients: z.array(z.string()),
			instructions: z.array(z.string()),
		})
		.optional(),
	tags: z
		.object({
			tags: z.array(z.string()),
			mealType: z.string(),
			healthScore: z.number(),
			totalTimeMinutes: z.number(),
		})
		.optional(),
});

/**
 * Zod schema for Error event.
 */
const errorEventSchema = z.object({
	type: z.literal(ServerProgressEventType.Error),
	success: z.literal(false),
	error: z.string(),
	notionUrl: z.string().optional(),
});

/**
 * Zod schema for ServerProgressEvent (discriminated union).
 */
const serverProgressEventSchema = z.discriminatedUnion("type", [
	progressEventSchema,
	completeEventSchema,
	errorEventSchema,
]);

/**
 * Validates that a parsed JSON object is a valid ServerProgressEvent using Zod.
 *
 * Uses Zod's safeParse to validate without throwing errors.
 * Returns null for invalid data, allowing the SSE parser to skip malformed events.
 *
 * @param data - The parsed JSON data to validate.
 * @returns The validated ServerProgressEvent, or null if invalid.
 *
 * @example
 * ```ts
 * const parsed = JSON.parse(sseData);
 * const event = validateServerProgressEvent(parsed);
 *
 * if (event) {
 *   if (event.type === ServerProgressEventType.Progress) {
 *     console.log(event.message);
 *   } else if (event.type === ServerProgressEventType.Complete) {
 *     console.log("Saved:", event.notionUrl);
 *   }
 * } else {
 *   console.warn("Invalid SSE event:", parsed);
 * }
 * ```
 */
export function validateServerProgressEvent(data: unknown): ServerProgressEvent | null {
	const result = serverProgressEventSchema.safeParse(data);
	return result.success ? result.data : null;
}
