import { Client } from "@notionhq/client";
import { ELLIPSIS_LENGTH } from "@shared/constants";
import { hasProperty, isObject } from "@shared/type-guards";
import { NotionApiError } from "../errors";
import type { Recipe } from "../scraper";
import type { RecipeTags } from "../tagger";

/** Notion block types used in recipe pages. */
export enum NotionBlockType {
	Paragraph = "paragraph",
	Heading1 = "heading_1",
	Heading3 = "heading_3",
	BulletedListItem = "bulleted_list_item",
	NumberedListItem = "numbered_list_item",
	Column = "column",
	ColumnList = "column_list",
}

/** Notion database property names. */
export enum PropertyName {
	Name = "Name",
	Source = "Source",
	Author = "Author",
	Minutes = "Minutes",
	Tags = "Tags",
	MealType = "Meal type",
	HealthScore = "Health score",
}

/** Notion rich text object. */
export type NotionRichText = {
	type: "text";
	text: { content: string };
};

/** Generic Notion block type. */
export type NotionBlock = {
	object: "block";
	type: NotionBlockType;
	paragraph?: { rich_text: NotionRichText[] };
	heading_1?: { rich_text: NotionRichText[] };
	heading_3?: { rich_text: NotionRichText[] };
	bulleted_list_item?: { rich_text: NotionRichText[] };
	numbered_list_item?: { rich_text: NotionRichText[] };
	column?: { children: NotionBlock[] };
	column_list?: { children: NotionBlock[] };
};

/** Notion page properties structure. */
export type NotionProperties = Record<string, unknown>;

/** Information about a duplicate recipe. */
export type DuplicateInfo = {
	title: string;
	url: string;
	pageId: string;
	notionUrl: string;
};

/** Notion API error structure. */
export type NotionApiErrorResponse = {
	code?: string;
	message?: string;
	status?: number;
};

/** Options for creating a recipe page. */
export type CreateRecipePageOptions = {
	recipe: Recipe;
	tags: RecipeTags;
	notionApiKey: string;
	databaseId: string;
	skipDuplicateCheck?: boolean;
};

const PAGE_ID_DASH_PATTERN = /-/g;
const ESCAPED_DOUBLE_NEWLINE_PATTERN = /\\n\\n/g;
const ESCAPED_SINGLE_NEWLINE_PATTERN = /\\n/g;

/**
 * Creates a Notion API client instance.
 *
 * @param apiKey - Notion integration API key.
 * @returns Configured Notion client.
 */
export function createNotionClient(apiKey: string): Client {
	return new Client({ auth: apiKey });
}

/**
 * Converts a Notion page ID to a clickable URL.
 *
 * @param pageId - The Notion page ID (with or without dashes).
 * @returns The Notion page URL.
 */
export function getNotionPageUrl(pageId: string): string {
	const cleanId = pageId.replace(PAGE_ID_DASH_PATTERN, "");
	return `https://www.notion.so/${cleanId}`;
}

/**
 * Type guard for Notion API error responses.
 *
 * @param error - The error to check.
 * @returns True if the error is a Notion API error response.
 */
export function isNotionApiErrorResponse(error: unknown): error is NotionApiErrorResponse {
	return isObject(error) && hasProperty(error, "code");
}

/**
 * Handles Notion API errors.
 *
 * @param error - The error from the Notion API.
 * @param propertyName - The property name being accessed.
 * @param propertyType - The expected property type.
 * @throws NotionApiError with detailed information.
 */
export function handleNotionApiError(
	error: unknown,
	propertyName: string,
	propertyType: string,
): never {
	if (isNotionApiErrorResponse(error)) {
		throw new NotionApiError({
			message: `Notion API error: ${error.status || "Unknown"} ${error.message || "Unknown error"}. ${error.code ? `(code: ${error.code})` : ""}. Check that the property "${propertyName}" exists in your database and is a ${propertyType} type.`,
			statusCode: error.status || 500,
			propertyName,
			propertyType,
		});
	}
	throw error;
}

/**
 * Normalizes description text by handling escaped newlines.
 *
 * @param text - The text to normalize.
 * @returns Normalized text with proper newlines.
 */
export function normalizeDescriptionText(text: string): string {
	return text
		.replace(ESCAPED_DOUBLE_NEWLINE_PATTERN, "\n\n")
		.replace(ESCAPED_SINGLE_NEWLINE_PATTERN, "\n");
}

/**
 * Truncates text to a maximum length.
 *
 * @param text - The text to truncate.
 * @param maxLength - The maximum allowed length.
 * @returns Truncated text with "..." if needed.
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - ELLIPSIS_LENGTH)}...`;
}

/**
 * Builds the page properties for a Notion recipe page.
 *
 * @param recipe - The recipe data.
 * @param tags - AI-generated tags.
 * @returns Record of Notion page properties.
 */
export function buildPageProperties(recipe: Recipe, tags: RecipeTags): NotionProperties {
	return {
		[PropertyName.Name]: {
			title: [{ text: { content: recipe.name } }],
		},
		[PropertyName.Source]: {
			url: recipe.sourceUrl,
		},
		[PropertyName.Tags]: {
			multi_select: tags.tags.map((t) => ({ name: t })),
		},
		[PropertyName.MealType]: {
			select: { name: tags.mealType },
		},
		[PropertyName.HealthScore]: {
			number: tags.healthScore,
		},
		[PropertyName.Minutes]: {
			number: tags.totalTimeMinutes,
		},
		[PropertyName.Author]: {
			rich_text: [{ text: { content: recipe.author } }],
		},
	};
}

/** Options for building page parameters. */
export type BuildPageParamsOptions = {
	databaseId: string;
	properties: NotionProperties;
	children: NotionBlock[];
	imageUrl?: string | null;
};

/**
 * Builds the page parameters for creating a Notion page.
 *
 * @param options - Options for building page parameters.
 * @returns Record of Notion page creation parameters.
 */
export function buildPageParams(options: BuildPageParamsOptions): Record<string, unknown> {
	const { databaseId, properties, children, imageUrl } = options;

	const pageParams: Record<string, unknown> = {
		parent: { database_id: databaseId },
		properties,
		children,
	};

	if (imageUrl) {
		pageParams.cover = {
			type: "external",
			external: { url: imageUrl },
		};
	}

	return pageParams;
}
