import { Client } from "@notionhq/client";
import { DuplicateRecipeError, NotionApiError } from "./errors.js";
import type { Recipe } from "./scraper.js";
import { hasProperty, isArray, isObject } from "./shared/type-guards.js";
import type { CategorizedIngredient, RecipeTags } from "./tagger.js";
import { IngredientCategory } from "./tagger.js";

/**
 * Notion database property names.
 * These must match the property names in your Notion database.
 */
const PropertyNames = {
	NAME: "Name",
	SOURCE: "Source",
	AUTHOR: "Author",
	MINUTES: "Minutes",
	TAGS: "Tags",
	MEAL_TYPE: "Meal type",
	HEALTHINESS: "Healthiness",
} as const;

/**
 * Maximum text length for Notion text blocks (characters).
 */
const MAX_TEXT_LENGTH = 2000;

/**
 * Maximum number of blocks allowed in a Notion page.
 */
const MAX_NOTION_BLOCKS = 100;

/**
 * Length of ellipsis string ("...") used when truncating text.
 */
const ELLIPSIS_LENGTH = 3;

/**
 * Pattern to match escaped double newlines in description text.
 */
const ESCAPED_DOUBLE_NEWLINE_PATTERN = /\\n\\n/g;

/**
 * Pattern to match escaped single newlines in description text.
 */
const ESCAPED_SINGLE_NEWLINE_PATTERN = /\\n/g;

/**
 * Pattern to match dashes in Notion page IDs (for URL conversion).
 */
const PAGE_ID_DASH_PATTERN = /-/g;

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
 * Converts a Notion page ID to a clickable URL.
 *
 * Removes dashes if present and formats as URL.
 *
 * @param pageId - The Notion page ID (with or without dashes).
 * @returns The Notion page URL.
 */
export function getNotionPageUrl(pageId: string): string {
	const cleanId = pageId.replace(PAGE_ID_DASH_PATTERN, "");
	return `https://www.notion.so/${cleanId}`;
}

/**
 * Checks if a recipe with the same URL already exists in the database.
 *
 * Useful for early duplicate detection before scraping.
 * Queries for recipes with the same URL using the Notion SDK.
 *
 * @param url - Recipe URL to check for duplicates.
 * @param notionApiKey - Notion integration API key.
 * @param databaseId - Target Notion database ID.
 * @returns Information about the duplicate if found, null otherwise.
 */
export async function checkForDuplicateByUrl(
	url: string,
	notionApiKey: string,
	databaseId: string,
): Promise<DuplicateInfo | null> {
	const notion = new Client({ auth: notionApiKey });

	try {
		// Use request method to call databases.query endpoint directly
		// The databases.query method doesn't exist in the SDK, so we call it via request
		// Replace {database_id} in the path with the actual database ID
		const urlQuery = (await notion.request({
			method: "post",
			path: `databases/${databaseId}/query`,
			body: {
				filter: {
					property: PropertyNames.SOURCE,
					url: {
						equals: url,
					},
				},
			},
		})) as { results: Array<{ id: string; properties?: Record<string, unknown> }> };

		if (urlQuery.results.length === 0) {
			return null;
		}

		const page = urlQuery.results[0];
		if (!page) {
			return null;
		}
		const pageId = page.id;
		const properties = page.properties || {};

		const title =
			PropertyNames.NAME in properties
				? extractTitle(properties[PropertyNames.NAME])
				: "Unknown Recipe";

		const foundUrl =
			PropertyNames.SOURCE in properties ? extractUrl(properties[PropertyNames.SOURCE]) : url;

		return {
			title,
			url: foundUrl,
			pageId,
			notionUrl: getNotionPageUrl(pageId),
		};
	} catch (error) {
		if (isObject(error) && hasProperty(error, "code")) {
			const notionError = error as { code?: string; message?: string; status?: number };
			throw new NotionApiError({
				message: `Notion API error: ${notionError.status || "Unknown"} ${notionError.message || "Unknown error"}. ${notionError.code ? `(code: ${notionError.code})` : ""}. Check that the property "${PropertyNames.SOURCE}" exists in your database and is a URL type.`,
				statusCode: notionError.status || 500,
				propertyName: PropertyNames.SOURCE,
				propertyType: "URL",
			});
		}
		throw error;
	}
}

/**
 * Checks if a recipe with the same title already exists in the database.
 *
 * Use this after already checking for URL duplicates to avoid redundant API calls.
 * Queries for recipes with the same title using the Notion SDK.
 *
 * @param recipeName - Recipe name to check for duplicates.
 * @param notionApiKey - Notion integration API key.
 * @param databaseId - Target Notion database ID.
 * @returns Information about the duplicate if found, null otherwise.
 */
export async function checkForDuplicateByTitle(
	recipeName: string,
	notionApiKey: string,
	databaseId: string,
): Promise<DuplicateInfo | null> {
	const notion = new Client({ auth: notionApiKey });

	try {
		// Use request method to call databases.query endpoint directly
		// The databases.query method doesn't exist in the SDK, so we call it via request
		// Replace {database_id} in the path with the actual database ID
		const titleQuery = (await notion.request({
			method: "post",
			path: `databases/${databaseId}/query`,
			body: {
				filter: {
					property: PropertyNames.NAME,
					title: {
						equals: recipeName,
					},
				},
			},
		})) as { results: Array<{ id: string; properties?: Record<string, unknown> }> };

		if (titleQuery.results.length === 0) {
			return null;
		}

		const page = titleQuery.results[0];

		if (!page) {
			return null;
		}

		const pageId = page.id;
		const properties = page.properties || {};

		const title =
			PropertyNames.NAME in properties ? extractTitle(properties[PropertyNames.NAME]) : recipeName;

		const url =
			PropertyNames.SOURCE in properties ? extractUrl(properties[PropertyNames.SOURCE]) : "";

		return {
			title,
			url,
			pageId,
			notionUrl: getNotionPageUrl(pageId),
		};
	} catch (error) {
		if (isObject(error) && hasProperty(error, "code")) {
			const notionError = error as { code?: string; message?: string; status?: number };
			throw new NotionApiError({
				message: `Notion API error: ${notionError.status || "Unknown"} ${notionError.message || "Unknown error"}. ${notionError.code ? `(code: ${notionError.code})` : ""}. Check that the property "${PropertyNames.NAME}" exists in your database and is a Title type.`,
				statusCode: notionError.status || 500,
				propertyName: PropertyNames.NAME,
				propertyType: "Title",
			});
		}
		throw error;
	}
}

/**
 * Options for checking for duplicate recipes.
 */
type CheckForDuplicateOptions = {
	recipe: Recipe;
	notionApiKey: string;
	databaseId: string;
	skipUrlCheck?: boolean;
};

/**
 * Checks if a recipe with the same title or URL already exists in the database.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise.
 */
async function checkForDuplicate({
	recipe,
	notionApiKey,
	databaseId,
	skipUrlCheck = false,
}: CheckForDuplicateOptions): Promise<DuplicateInfo | null> {
	/**
	 * First check for URL duplicates (unless already checked).
	 */
	if (!skipUrlCheck) {
		const urlDuplicate = await checkForDuplicateByUrl(recipe.sourceUrl, notionApiKey, databaseId);

		if (urlDuplicate) {
			return urlDuplicate;
		}
	}

	/**
	 * Query for recipes with the same title.
	 */
	return await checkForDuplicateByTitle(recipe.name, notionApiKey, databaseId);
}

/**
 * Extracts the title text from a Notion title property.
 *
 * @param property - The Notion title property object.
 * @returns The plain text title, or empty string if not found.
 */
function extractTitle(property: unknown): string {
	if (!property || typeof property !== "object" || property === null) {
		return "";
	}

	if (!hasProperty(property, "title") || !isArray(property.title)) {
		return "";
	}

	if (property.title.length === 0) {
		return "";
	}

	const firstTitle = property.title[0];

	if (!isObject(firstTitle) || !hasProperty(firstTitle, "plain_text")) {
		return "";
	}

	return String(firstTitle.plain_text);
}

/**
 * Extracts the URL from a Notion URL property.
 *
 * @param property - The Notion URL property object.
 * @returns The URL string, or empty string if not found.
 */
function extractUrl(property: unknown): string {
	if (!property || typeof property !== "object" || property === null) {
		return "";
	}

	if (!("url" in property) || property.url === null) {
		return "";
	}

	return String(property.url);
}

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
 * Creates a new page in the Notion recipe database with the recipe's metadata,
 * cover image, and body content (ingredients + instructions).
 *
 * @param options - Options for creating the recipe page.
 * @returns The ID of the newly created Notion page.
 * @throws If a duplicate recipe (same title or URL) already exists and skipDuplicateCheck is false.
 */
export async function createRecipePage({
	recipe,
	tags,
	notionApiKey,
	databaseId,
	skipDuplicateCheck = false,
}: CreateRecipePageOptions): Promise<string> {
	const notion = new Client({ auth: notionApiKey });

	if (!skipDuplicateCheck) {
		const duplicate = await checkForDuplicate({
			recipe,
			notionApiKey,
			databaseId,
		});

		if (duplicate) {
			throw new DuplicateRecipeError(duplicate.title, duplicate.url, duplicate.notionUrl);
		}
	}

	const properties: Record<string, unknown> = {
		[PropertyNames.NAME]: {
			title: [{ text: { content: recipe.name } }],
		},
		[PropertyNames.SOURCE]: {
			url: recipe.sourceUrl,
		},
		[PropertyNames.TAGS]: {
			multi_select: tags.tags.map((t) => ({ name: t })),
		},
		[PropertyNames.MEAL_TYPE]: {
			multi_select: tags.mealType.map((m) => ({ name: m })),
		},
		[PropertyNames.HEALTHINESS]: {
			number: tags.healthiness,
		},
	};

	if (recipe.author) {
		properties[PropertyNames.AUTHOR] = {
			rich_text: [{ text: { content: recipe.author } }],
		};
	}

	properties[PropertyNames.MINUTES] = { number: tags.totalTimeMinutes };

	const children = buildPageBody(recipe, tags);

	const pageParams: Record<string, unknown> = {
		parent: { database_id: databaseId },
		properties,
		children,
	};

	if (recipe.imageUrl) {
		pageParams.cover = {
			type: "external",
			external: { url: recipe.imageUrl },
		};
	}

	const page = await notion.pages.create(pageParams as Parameters<typeof notion.pages.create>[0]);
	return page.id;
}

/**
 * Builds ingredient blocks grouped by category.
 *
 * @param grouped - Map of category names to arrays of ingredients.
 * @returns Array of Notion block objects for ingredients.
 */
function buildIngredientBlocks(
	grouped: Map<IngredientCategory, Array<{ name: string }>>,
): unknown[] {
	const blocks: unknown[] = [];
	const orderedCategories = getCategoryOrder();

	const otherCategories = Array.from(grouped.keys())
		.filter((category) => !orderedCategories.includes(category))
		.sort();

	const allCategories = [...orderedCategories, ...otherCategories];

	for (const category of allCategories) {
		const ingredients = grouped.get(category);

		if (!ingredients || ingredients.length === 0) {
			continue;
		}

		blocks.push(heading3(category));
		for (const ingredient of ingredients) {
			blocks.push(bulletItem(ingredient.name));
		}
	}

	return blocks;
}

/**
 * Builds the main body content for a Notion recipe page.
 *
 * Creates blocks in order: description (if available), ingredients (grouped by category if AI-tagged,
 * otherwise as simple list), and instructions. Limits output to MAX_NOTION_BLOCKS to comply with
 * Notion's 100 block per page limit.
 *
 * @param recipe - The recipe data to build the page body from.
 * @param tags - AI-generated tags including description.
 * @returns An array of Notion block objects (limited to MAX_NOTION_BLOCKS).
 */
function buildPageBody(recipe: Recipe, tags: RecipeTags): unknown[] {
	const blocks: unknown[] = [];

	if (tags.description) {
		const descriptionText = normalizeDescriptionText(tags.description);
		const paragraphs = descriptionText.split("\n\n").filter((paragraph) => paragraph.trim());
		for (const paragraphText of paragraphs) {
			blocks.push(paragraph(paragraphText));
		}
	}

	if (tags.ingredients && tags.ingredients.length > 0) {
		blocks.push(heading1("Ingredients"));
		const grouped = groupIngredientsByCategory(tags.ingredients);
		const simplified = new Map<IngredientCategory, Array<{ name: string }>>();
		for (const [category, ingredients] of grouped.entries()) {
			simplified.set(
				category,
				ingredients.map((ing) => ({ name: ing.name })),
			);
		}
		blocks.push(...buildIngredientBlocks(simplified));
	} else if (recipe.ingredients.length > 0) {
		blocks.push(heading1("Ingredients"));
		for (const ingredient of recipe.ingredients) {
			blocks.push(bulletItem(ingredient));
		}
	}

	if (recipe.instructions.length > 0) {
		blocks.push(heading1("Preparation"));
		for (const step of recipe.instructions) {
			blocks.push(numberedItem(step));
		}
	}

	return blocks.slice(0, MAX_NOTION_BLOCKS);
}

/**
 * Creates a paragraph block for Notion.
 *
 * @param text - The paragraph text content (truncated to 2000 chars).
 * @returns A Notion paragraph block object.
 */
function paragraph(text: string): unknown {
	return {
		object: "block",
		type: "paragraph",
		paragraph: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Creates a heading_1 block for Notion.
 *
 * @param text - The heading text content.
 * @returns A Notion heading_1 block object.
 */
function heading1(text: string): unknown {
	return {
		object: "block",
		type: "heading_1",
		heading_1: {
			rich_text: [{ type: "text", text: { content: text } }],
		},
	};
}

/**
 * Creates a heading_3 block for Notion (for ingredient categories).
 *
 * @param text - The heading text content.
 * @returns A Notion heading_3 block object.
 */
function heading3(text: string): unknown {
	return {
		object: "block",
		type: "heading_3",
		heading_3: {
			rich_text: [{ type: "text", text: { content: text } }],
		},
	};
}

/**
 * Creates a bulleted_list_item block for Notion.
 *
 * @param text - The list item text content (truncated to 2000 chars).
 * @returns A Notion bulleted_list_item block object.
 */
function bulletItem(text: string): unknown {
	return {
		object: "block",
		type: "bulleted_list_item",
		bulleted_list_item: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Creates a numbered_list_item block for Notion.
 *
 * @param text - The list item text content (truncated to 2000 chars).
 * @returns A Notion numbered_list_item block object.
 */
function numberedItem(text: string): unknown {
	return {
		object: "block",
		type: "numbered_list_item",
		numbered_list_item: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Normalizes description text by handling escaped newlines.
 *
 * Converts both literal \n\n strings (escaped) and actual newlines to proper paragraph breaks.
 * Processes escaped newlines first, then actual newlines.
 *
 * @param text - The description text to normalize.
 * @returns Normalized text with proper newline handling.
 */
function normalizeDescriptionText(text: string): string {
	return text
		.replace(ESCAPED_DOUBLE_NEWLINE_PATTERN, "\n\n")
		.replace(ESCAPED_SINGLE_NEWLINE_PATTERN, "\n");
}

/**
 * Truncates text to a maximum length, appending "..." if truncated.
 *
 * @param text - The text to truncate.
 * @param maxLength - The maximum allowed length.
 * @returns The truncated text with "..." appended if needed.
 */
function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - ELLIPSIS_LENGTH)}...`;
}

/**
 * Groups ingredients by their shopping category.
 *
 * @param ingredients - Array of categorized ingredients.
 * @returns Map of category name to array of ingredients in that category.
 */
function groupIngredientsByCategory(
	ingredients: CategorizedIngredient[],
): Map<IngredientCategory, CategorizedIngredient[]> {
	return ingredients.reduce((map, ingredient) => {
		const category = ingredient.category;
		const group = map.get(category);

		if (group) {
			group.push(ingredient);
		} else {
			map.set(category, [ingredient]);
		}

		return map;
	}, new Map<IngredientCategory, CategorizedIngredient[]>());
}

/**
 * Returns the standard grocery store category order.
 * Produce → Bakery → Meat & seafood → Pantry → Dairy & eggs → Frozen → Other
 *
 * Categories not in this list will appear after Frozen in alphabetical order.
 *
 * @returns Array of category names in shopping order.
 */
function getCategoryOrder(): IngredientCategory[] {
	return [
		IngredientCategory.Produce,
		IngredientCategory.Bakery,
		IngredientCategory.MeatSeafood,
		IngredientCategory.Pantry,
		IngredientCategory.DairyEggs,
		IngredientCategory.Frozen,
		IngredientCategory.Other,
	];
}
