import { Client } from "@notionhq/client";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

/**
 * Notion database property names.
 */
enum PropertyNames {
	NAME = "Name",
	SOURCE = "Source",
	AUTHOR = "Author",
	MINUTES = "Minutes",
	TAGS = "Tags",
	MEAL_TYPE = "Meal type",
	HEALTHINESS = "Healthiness",
}

/**
 * Valid meal type options for the Meal type multi-select property.
 */
enum MealType {
	BREAKFAST = "Breakfast",
	LUNCH = "Lunch",
	DINNER = "Dinner",
	SNACK = "Snack",
	DESSERT = "Dessert",
	APPETIZER = "Appetizer",
	SIDE_DISH = "Side dish",
}

const MEAL_TYPE_OPTIONS = Object.values(MealType);

/**
 * Information about an existing recipe that matches a duplicate check.
 */
export interface DuplicateInfo {
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
}

/**
 * Converts a Notion page ID to a clickable URL.
 *
 * @param pageId - The Notion page ID (with or without dashes).
 * @returns The Notion page URL.
 */
export function getNotionPageUrl(pageId: string): string {
	// Remove dashes if present and format as URL
	const cleanId = pageId.replace(/-/g, "");
	return `https://www.notion.so/${cleanId}`;
}

/**
 * Checks if a recipe with the same URL already exists in the database.
 * Useful for early duplicate detection before scraping.
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
	// Query for recipes with the same URL using direct API call
	const response = await fetch(
		`https://api.notion.com/v1/databases/${databaseId}/query`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${notionApiKey}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				filter: {
					property: PropertyNames.SOURCE,
					url: {
						equals: url,
					},
				},
			}),
		},
	);

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({}));
		const errorMessage = errorBody.message || response.statusText;
		const code = errorBody.code || "";
		throw new Error(
			`Notion API error: ${response.status} ${response.statusText}. ${errorMessage}${code ? ` (code: ${code})` : ""}. ` +
				`Check that the property "${PropertyNames.SOURCE}" exists in your database and is a URL type.`,
		);
	}

	const urlQuery = await response.json();

	if (urlQuery.results.length > 0) {
		const page = urlQuery.results[0];
		const pageId = page.id;
		const title =
			page.properties && PropertyNames.NAME in page.properties
				? extractTitle(page.properties[PropertyNames.NAME])
				: "Unknown Recipe";
		const foundUrl =
			page.properties && PropertyNames.SOURCE in page.properties
				? extractUrl(page.properties[PropertyNames.SOURCE])
				: url;
		return {
			title,
			url: foundUrl,
			pageId,
			notionUrl: getNotionPageUrl(pageId),
		};
	}

	return null;
}

/**
 * Checks if a recipe with the same title already exists in the database.
 * Use this after already checking for URL duplicates to avoid redundant API calls.
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
	// Query for recipes with the same title using direct API call
	const response = await fetch(
		`https://api.notion.com/v1/databases/${databaseId}/query`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${notionApiKey}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				filter: {
					property: PropertyNames.NAME,
					title: {
						equals: recipeName,
					},
				},
			}),
		},
	);

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({}));
		const errorMessage = errorBody.message || response.statusText;
		const code = errorBody.code || "";
		throw new Error(
			`Notion API error: ${response.status} ${response.statusText}. ${errorMessage}${code ? ` (code: ${code})` : ""}. ` +
				`Check that the property "${PropertyNames.NAME}" exists in your database and is a Title type.`,
		);
	}

	const titleQuery = await response.json();

	if (titleQuery.results.length > 0) {
		const page = titleQuery.results[0];
		const pageId = page.id;
		const title =
			page.properties && PropertyNames.NAME in page.properties
				? extractTitle(page.properties[PropertyNames.NAME])
				: recipeName;
		const url =
			page.properties && PropertyNames.SOURCE in page.properties
				? extractUrl(page.properties[PropertyNames.SOURCE])
				: "";
		return { title, url, pageId, notionUrl: getNotionPageUrl(pageId) };
	}

	return null;
}

/**
 * Checks if a recipe with the same title or URL already exists in the database.
 *
 * @param recipe - Scraped recipe data to check for duplicates.
 * @param notionApiKey - Notion integration API key.
 * @param databaseId - Target Notion database ID.
 * @param skipUrlCheck - If true, skips URL duplicate check (assumes already checked).
 * @returns Information about the duplicate if found, null otherwise.
 */
export async function checkForDuplicate(
	recipe: Recipe,
	notionApiKey: string,
	databaseId: string,
	skipUrlCheck: boolean = false,
): Promise<DuplicateInfo | null> {
	// First check for URL duplicates (unless already checked)
	if (!skipUrlCheck) {
		const urlDuplicate = await checkForDuplicateByUrl(
			recipe.sourceUrl,
			notionApiKey,
			databaseId,
		);
		if (urlDuplicate) {
			return urlDuplicate;
		}
	}

	// Query for recipes with the same title
	return await checkForDuplicateByTitle(recipe.name, notionApiKey, databaseId);
}

/**
 * Extracts the title text from a Notion title property.
 */
function extractTitle(property: unknown): string {
	if (
		property &&
		typeof property === "object" &&
		"title" in property &&
		Array.isArray(property.title) &&
		property.title.length > 0 &&
		typeof property.title[0] === "object" &&
		property.title[0] !== null &&
		"plain_text" in property.title[0]
	) {
		return String(property.title[0].plain_text);
	}
	return "";
}

/**
 * Extracts the URL from a Notion URL property.
 */
function extractUrl(property: unknown): string {
	if (
		property &&
		typeof property === "object" &&
		"url" in property &&
		property.url !== null
	) {
		return String(property.url);
	}
	return "";
}

/**
 * Creates a new page in the Notion recipe database with the recipe's metadata,
 * cover image, and body content (ingredients + instructions).
 *
 * @param recipe - Scraped recipe data.
 * @param tags - AI-generated scores and classifications.
 * @param notionApiKey - Notion integration API key.
 * @param databaseId - Target Notion database ID.
 * @param skipDuplicateCheck - If true, skips duplicate checking (useful when duplicates are already checked earlier).
 * @returns The ID of the newly created Notion page.
 * @throws If a duplicate recipe (same title or URL) already exists and skipDuplicateCheck is false.
 */
export async function createRecipePage(
	recipe: Recipe,
	tags: RecipeTags,
	notionApiKey: string,
	databaseId: string,
	skipDuplicateCheck: boolean = false,
): Promise<string> {
	const notion = new Client({ auth: notionApiKey });

	// Check for duplicates before creating (unless explicitly skipped)
	if (!skipDuplicateCheck) {
		const duplicate = await checkForDuplicate(recipe, notionApiKey, databaseId);
		if (duplicate) {
			throw new Error(
				`Duplicate recipe found: "${duplicate.title}" (${duplicate.url}) already exists in the database. View it at: ${duplicate.notionUrl}`,
			);
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

	const page = await notion.pages.create(
		pageParams as Parameters<typeof notion.pages.create>[0],
	);
	return page.id;
}

/**
 * Builds the Notion page body: description, then "Ingredients" heading followed by bulleted
 * list items, then an "Instructions" heading followed by numbered list items.
 *
 * Creates the content blocks for a Notion page, including paragraphs, headings
 * and lists. Truncates to 100 blocks to respect Notion API limits.
 *
 * @param recipe - The recipe data to build the page body from.
 * @param tags - AI-generated tags including description.
 * @returns An array of Notion block objects.
 */
function buildPageBody(recipe: Recipe, tags: RecipeTags): unknown[] {
	const blocks: unknown[] = [];

	// Add description if available
	if (tags.description) {
		blocks.push(paragraph(tags.description));
	}

	if (recipe.ingredients.length > 0) {
		blocks.push(heading("Ingredients"));
		for (const ingredient of recipe.ingredients) {
			blocks.push(bulletItem(ingredient));
		}
	}

	if (recipe.instructions.length > 0) {
		blocks.push(heading("Instructions"));
		for (const step of recipe.instructions) {
			blocks.push(numberedItem(step));
		}
	}

	return blocks.slice(0, 100);
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
			rich_text: [{ type: "text", text: { content: truncate(text, 2000) } }],
		},
	};
}

/**
 * Creates a heading_2 block for Notion.
 *
 * @param text - The heading text content.
 * @returns A Notion heading_2 block object.
 */
function heading(text: string): unknown {
	return {
		object: "block",
		type: "heading_2",
		heading_2: {
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
			rich_text: [{ type: "text", text: { content: truncate(text, 2000) } }],
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
			rich_text: [{ type: "text", text: { content: truncate(text, 2000) } }],
		},
	};
}

/**
 * Truncates text to a maximum length, appending "..." if truncated.
 *
 * @param text - The text to truncate.
 * @param maxLength - The maximum allowed length.
 * @returns The truncated text with "..." appended if needed.
 */
function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Ensures the target Notion database has all required properties with the
 * correct types. Creates any missing properties and pre-populates the
 * Meal type multi-select options.
 *
 * Note: The Notion API does not support creating views programmatically.
 * Views (Gallery, Quick Meals, etc.) must be configured manually in Notion.
 *
 * @param notionApiKey - Notion integration API key.
 * @param databaseId - Target Notion database ID.
 * @throws If the database is not accessible by the integration.
 */
export async function setupDatabaseViews(
	notionApiKey: string,
	databaseId: string,
): Promise<void> {
	const notion = new Client({ auth: notionApiKey });

	await notion.databases.retrieve({ database_id: databaseId });

	// biome-ignore lint/complexity/noBannedTypes: Notion SDK types don't expose update properly
	await (notion.databases.update as Function)({
		database_id: databaseId,
		properties: {
			[PropertyNames.NAME]: { title: {} },
			[PropertyNames.SOURCE]: { url: {} },
			[PropertyNames.AUTHOR]: { rich_text: {} },
			[PropertyNames.MINUTES]: { number: { format: "number" } },
			[PropertyNames.TAGS]: { multi_select: { options: [] } },
			[PropertyNames.MEAL_TYPE]: {
				multi_select: {
					options: MEAL_TYPE_OPTIONS.map((name) => ({ name })),
				},
			},
			[PropertyNames.HEALTHINESS]: { number: { format: "number" } },
		},
	});
}
