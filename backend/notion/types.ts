import type { Recipe } from "../scraper.js";
import type { RecipeTags } from "../tagger.js";

/**
 * Notion database property names.
 * These must match the property names in your Notion database.
 */
export const PropertyNames = {
	NAME: "Name",
	SOURCE: "Source",
	AUTHOR: "Author",
	MINUTES: "Minutes",
	TAGS: "Tags",
	MEAL_TYPE: "Meal type",
	HEALTH_SCORE: "Health score",
} as const;

/**
 * Information about an existing recipe that matches a duplicate check.
 */
export type DuplicateInfo = {
	/**
	 * Recipe title in Notion.
	 */
	title: string;
	/**
	 * Original source URL of the recipe.
	 */
	url: string;
	/**
	 * Notion page ID.
	 */
	pageId: string;
	/**
	 * Clickable Notion page URL.
	 */
	notionUrl: string;
};

/**
 * Options for checking duplicate recipes by URL.
 */
export type CheckDuplicateByUrlOptions = {
	/** Recipe URL to check for duplicates. */
	url: string;
	/** Notion integration API key. */
	notionApiKey: string;
	/** Target Notion database ID. */
	databaseId: string;
};

/**
 * Options for checking duplicate recipes by title.
 */
export type CheckDuplicateByTitleOptions = {
	/** Recipe name to check for duplicates. */
	recipeName: string;
	/** Notion integration API key. */
	notionApiKey: string;
	/** Target Notion database ID. */
	databaseId: string;
};

/**
 * Options for creating a recipe page in Notion.
 */
export type CreateRecipePageOptions = {
	recipe: Recipe;
	tags: RecipeTags;
	notionApiKey: string;
	databaseId: string;
	skipDuplicateCheck?: boolean;
};

/**
 * Notion API error structure.
 */
export type NotionApiErrorResponse = {
	code?: string;
	message?: string;
	status?: number;
};

/**
 * Options for building page parameters.
 */
export type BuildPageParamsOptions = {
	databaseId: string;
	properties: Record<string, unknown>;
	children: unknown[];
	imageUrl?: string | null;
};
