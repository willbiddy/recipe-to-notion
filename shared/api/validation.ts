import { z } from "zod";
import { ProgressType } from "../constants.js";
import { type ServerProgressEvent, ServerProgressEventType } from "./types.js";

/**
 * Zod schema for Progress event.
 */
const progressEventSchema = z.object({
	type: z.literal(ServerProgressEventType.Progress),
	message: z.string(),
	progressType: z.nativeEnum(ProgressType),
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
			mealType: z.array(z.string()),
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
 * @param data - The parsed JSON data to validate.
 * @returns The validated ServerProgressEvent, or null if invalid.
 */
export function validateServerProgressEvent(data: unknown): ServerProgressEvent | null {
	const result = serverProgressEventSchema.safeParse(data);
	return result.success ? result.data : null;
}
