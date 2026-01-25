import { Client } from "@notionhq/client";
import type { Recipe } from "./scraper.js";
import type { CategorizedIngredient, RecipeTags } from "./tagger.js";

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
	const cleanId = pageId.replace(/-/g, "");
	return `https://www.notion.so/${cleanId}`;
}

/**
 * Checks if a recipe with the same URL already exists in the database.
 *
 * Useful for early duplicate detection before scraping.
 * Queries for recipes with the same URL using direct API call.
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
	const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${notionApiKey}`,
			"Notion-Version": NOTION_API_VERSION,
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
	});

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
 *
 * Use this after already checking for URL duplicates to avoid redundant API calls.
 * Queries for recipes with the same title using direct API call.
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
	const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${notionApiKey}`,
			"Notion-Version": NOTION_API_VERSION,
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
	});

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
 *
 * @param property - The Notion URL property object.
 * @returns The URL string, or empty string if not found.
 */
function extractUrl(property: unknown): string {
	if (property && typeof property === "object" && "url" in property && property.url !== null) {
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

	const page = await notion.pages.create(pageParams as Parameters<typeof notion.pages.create>[0]);
	return page.id;
}

/**
 * Builds ingredient blocks grouped by category.
 *
 * @param grouped - Map of category names to arrays of ingredients.
 * @returns Array of Notion block objects for ingredients.
 */
function buildIngredientBlocks(grouped: Map<string, Array<{ name: string }>>): unknown[] {
	const blocks: unknown[] = [];
	const orderedCategories = getCategoryOrder();
	const otherCategories: string[] = [];

	for (const category of grouped.keys()) {
		if (!orderedCategories.includes(category)) {
			otherCategories.push(category);
		}
	}
	otherCategories.sort();

	for (const category of [...orderedCategories, ...otherCategories]) {
		const ingredients = grouped.get(category);
		if (ingredients && ingredients.length > 0) {
			blocks.push(heading3(category));
			for (const ingredient of ingredients) {
				blocks.push(bulletItem(ingredient.name));
			}
		}
	}

	return blocks;
}

/**
 * Builds the main body content for a Notion recipe page.
 *
 * @param recipe - The recipe data to build the page body from.
 * @param tags - AI-generated tags including description.
 * @returns An array of Notion block objects.
 */
function buildPageBody(recipe: Recipe, tags: RecipeTags): unknown[] {
	const blocks: unknown[] = [];

	if (tags.description) {
		let descriptionText = tags.description;
		// Handle both literal \n\n strings (escaped) and actual newlines
		// First replace escaped newlines, then split on actual newlines
		descriptionText = descriptionText.replace(/\\n\\n/g, "\n\n");
		// Also handle single escaped newlines that might be used for line breaks
		descriptionText = descriptionText.replace(/\\n/g, "\n");
		const paragraphs = descriptionText.split("\n\n").filter((p) => p.trim());
		for (const p of paragraphs) {
			blocks.push(paragraph(p));
		}
	}

	if (tags.ingredients && tags.ingredients.length > 0) {
		blocks.push(heading1("Ingredients"));
		const grouped = groupIngredientsByCategory(tags.ingredients);
		const converted = new Map<string, Array<{ name: string }>>();
		for (const [category, ingredients] of grouped.entries()) {
			converted.set(
				category,
				ingredients.map((ing) => ({
					name: ing.name,
				})),
			);
		}
		blocks.push(...buildIngredientBlocks(converted));
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
 * Groups ingredients by their shopping category.
 *
 * @param ingredients - Array of categorized ingredients.
 * @returns Map of category name to array of ingredients in that category.
 */
function groupIngredientsByCategory(
	ingredients: CategorizedIngredient[],
): Map<string, CategorizedIngredient[]> {
	const grouped = new Map<string, CategorizedIngredient[]>();
	for (const ingredient of ingredients) {
		const category = ingredient.category;
		if (!grouped.has(category)) {
			grouped.set(category, []);
		}
		grouped.get(category)?.push(ingredient);
	}
	return grouped;
}

/**
 * Returns the standard grocery store category order.
 * Produce → Deli & Bakery → Meat & Seafood → Pantry Aisles → Snacks & Soda → Dairy & Eggs → Frozen Foods → Household & Health → Checkout
 *
 * Categories not in this list will appear after Checkout in alphabetical order.
 *
 * @returns Array of category names in shopping order.
 */
function getCategoryOrder(): string[] {
	return [
		"Produce",
		"Deli & Bakery",
		"Meat & Seafood",
		"Pantry Aisles",
		"Snacks & Soda",
		"Dairy & Eggs",
		"Frozen Foods",
		"Household & Health",
		"Checkout",
	];
}
