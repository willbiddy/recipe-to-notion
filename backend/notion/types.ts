import type { Recipe } from "../scraper.js";
import type { RecipeTags } from "../tagger.js";

/**
 * Notion rich text object for text content.
 */
export type NotionRichText = {
	type: "text";
	text: { content: string };
};

/**
 * Notion paragraph block.
 */
export type NotionParagraphBlock = {
	object: "block";
	type: "paragraph";
	paragraph: { rich_text: NotionRichText[] };
};

/**
 * Notion heading_1 block.
 */
export type NotionHeading1Block = {
	object: "block";
	type: "heading_1";
	heading_1: { rich_text: NotionRichText[] };
};

/**
 * Notion heading_3 block.
 */
export type NotionHeading3Block = {
	object: "block";
	type: "heading_3";
	heading_3: { rich_text: NotionRichText[] };
};

/**
 * Notion bulleted list item block.
 */
export type NotionBulletedListItemBlock = {
	object: "block";
	type: "bulleted_list_item";
	bulleted_list_item: { rich_text: NotionRichText[] };
};

/**
 * Notion numbered list item block.
 */
export type NotionNumberedListItemBlock = {
	object: "block";
	type: "numbered_list_item";
	numbered_list_item: { rich_text: NotionRichText[] };
};

/**
 * Notion column block.
 */
export type NotionColumnBlock = {
	object: "block";
	type: "column";
	column: { children: NotionBlock[] };
};

/**
 * Notion column list block.
 */
export type NotionColumnListBlock = {
	object: "block";
	type: "column_list";
	column_list: { children: NotionColumnBlock[] };
};

/**
 * Union of all Notion block types used in recipe pages.
 */
export type NotionBlock =
	| NotionParagraphBlock
	| NotionHeading1Block
	| NotionHeading3Block
	| NotionBulletedListItemBlock
	| NotionNumberedListItemBlock
	| NotionColumnBlock
	| NotionColumnListBlock;

/**
 * Notion page properties structure.
 * Properties can have various types (title, url, multi_select, etc.).
 */
export type NotionProperties = Record<string, unknown>;

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
	properties: NotionProperties;
	children: NotionBlock[];
	imageUrl?: string | null;
};
