import { z } from "zod";
import { ProgressType } from "../constants.js";

/**
 * Method used to extract recipe data from the page.
 */
export enum ScrapeMethod {
	PythonScraper = "python-scrapers",
}

/**
 * Structured recipe data extracted from a web page.
 */
export type Recipe = {
	/**
	 * Display name of the recipe
	 */
	name: string;
	/**
	 * Original URL the recipe was scraped from
	 */
	sourceUrl: string;
	/**
	 * Method used to extract recipe data
	 */
	scrapeMethod: ScrapeMethod;
	/**
	 * Recipe author or source attribution
	 */
	author: string;
	/**
	 * Total preparation + cooking time in minutes, if available
	 */
	totalTimeMinutes: number | null;
	/**
	 * Serving size description (e.g. "4 servings"), if available
	 */
	servings: string | null;
	/**
	 * URL to the recipe's hero/header image for Notion cover
	 */
	imageUrl: string | null;
	/**
	 * List of ingredient strings (e.g. "2 cups flour")
	 */
	ingredients: string[];
	/**
	 * Ordered list of instruction steps
	 */
	instructions: string[];
	/**
	 * Source description from the recipe page, if available
	 */
	description: string | null;
	/**
	 * Cuisine type from the source (e.g., "Italian", "Mexican")
	 */
	cuisine: string | null;
	/**
	 * Recipe category from the source (e.g., "appetizer", "main course")
	 */
	category: string | null;
	/**
	 * Preparation time in minutes, if available
	 */
	prepTimeMinutes: number | null;
	/**
	 * Cooking time in minutes, if available
	 */
	cookTimeMinutes: number | null;
	/**
	 * User rating (float, e.g., 4.5), if available
	 */
	rating: number | null;
	/**
	 * Number of ratings, if available
	 */
	ratingsCount: number | null;
	/**
	 * Required kitchen equipment, if available
	 */
	equipment: string[] | null;
	/**
	 * Nutritional information (e.g., {"calories": "250 kcal"}), if available
	 */
	nutrients: Record<string, string> | null;
	/**
	 * Dietary restrictions (e.g., ["vegetarian", "gluten-free"]), if available
	 */
	dietaryRestrictions: string[] | null;
	/**
	 * Keywords/tags from the source, if available
	 */
	keywords: string[] | null;
	/**
	 * Cooking method (e.g., "baking", "grilling"), if available
	 */
	cookingMethod: string | null;
	/**
	 * Language code (e.g., "en"), if available
	 */
	language: string | null;
};

/**
 * Response format from the server API.
 */
export type RecipeResponse =
	| {
			success: true;
			pageId: string;
			notionUrl: string;
	  }
	| {
			success: false;
			error: string;
			notionUrl?: string;
	  };

/**
 * Server-Sent Event types for recipe processing progress.
 */
export enum ServerProgressEventType {
	Progress = "progress",
	Complete = "complete",
	Error = "error",
}

/**
 * Progress event from server.
 */
export type ServerProgressEvent =
	| {
			type: ServerProgressEventType.Progress;
			message: string;
			progressType: ProgressType;
	  }
	| {
			type: ServerProgressEventType.Complete;
			success: true;
			pageId: string;
			notionUrl: string;
			recipe?: {
				name: string;
				author: string;
				ingredients: string[];
				instructions: string[];
			};
			tags?: {
				tags: string[];
				mealType: string;
				healthScore: number;
				totalTimeMinutes: number;
			};
	  }
	| {
			type: ServerProgressEventType.Error;
			success: false;
			error: string;
			notionUrl?: string;
	  };

/**
 * Callbacks for progress updates.
 */
export type ProgressCallbacks = {
	onProgress: (message: string) => void;
	onComplete: (data: {
		pageId: string;
		notionUrl: string;
		recipe: {
			name: string;
			author: string;
			ingredients: string[];
			instructions: string[];
		};
		tags: {
			tags: string[];
			mealType: string;
			healthScore: number;
			totalTimeMinutes: number;
		};
	}) => void;
	onError: (error: string, notionUrl?: string) => void;
};

/**
 * Zod schema for Progress event.
 */
export const progressEventSchema = z.object({
	type: z.literal(ServerProgressEventType.Progress),
	message: z.string(),
	progressType: z.enum(ProgressType),
});

/**
 * Zod schema for Complete event.
 */
export const completeEventSchema = z.object({
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
export const errorEventSchema = z.object({
	type: z.literal(ServerProgressEventType.Error),
	success: z.literal(false),
	error: z.string(),
	notionUrl: z.string().optional(),
});

/**
 * Zod schema for ServerProgressEvent (discriminated union).
 */
export const serverProgressEventSchema = z.discriminatedUnion("type", [
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
 */
export function validateServerProgressEvent(data: unknown): ServerProgressEvent | null {
	const result = serverProgressEventSchema.safeParse(data);
	return result.success ? result.data : null;
}

import type { StorageAdapter } from "../storage.js";

/**
 * Options for saving a recipe.
 */
export type SaveRecipeOptions = {
	url: string;
	apiUrl: string;
	storage: StorageAdapter;
	callbacks: ProgressCallbacks;
};
