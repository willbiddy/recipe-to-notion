import { Client } from "@notionhq/client";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

/**
 * Notion database property names.
 */
const PROPERTY_NAMES = {
  NAME: "Name",
  SOURCE_URL: "Source URL",
  TOTAL_TIME: "Total Time",
  CUISINE: "Cuisine",
  MEAL_TYPE: "Meal type",
  HEALTHINESS: "Healthiness",
} as const;

/**
 * Valid meal type options for the Meal type multi-select property.
 */
const MEAL_TYPE_OPTIONS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
  "Appetizer",
  "Side Dish",
] as const;

/**
 * Creates a new page in the Notion recipe database with the recipe's metadata,
 * cover image, and body content (ingredients + instructions).
 *
 * @param recipe - Scraped recipe data.
 * @param tags - AI-generated scores and classifications.
 * @param notionApiKey - Notion integration API key.
 * @param databaseId - Target Notion database ID.
 * @returns The ID of the newly created Notion page.
 */
export async function createRecipePage(
  recipe: Recipe,
  tags: RecipeTags,
  notionApiKey: string,
  databaseId: string
): Promise<string> {
  const notion = new Client({ auth: notionApiKey });

  const properties: Record<string, unknown> = {
    [PROPERTY_NAMES.NAME]: {
      title: [{ text: { content: recipe.name } }],
    },
    [PROPERTY_NAMES.SOURCE_URL]: {
      url: recipe.sourceUrl,
    },
    [PROPERTY_NAMES.CUISINE]: {
      multi_select: tags.cuisine.map((c) => ({ name: c })),
    },
    [PROPERTY_NAMES.MEAL_TYPE]: {
      multi_select: tags.mealType.map((m) => ({ name: m })),
    },
    [PROPERTY_NAMES.HEALTHINESS]: {
      number: tags.healthiness,
    },
  };

  properties[PROPERTY_NAMES.TOTAL_TIME] = { number: tags.totalTimeMinutes };

  const children = buildPageBody(recipe);

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
 * Builds the Notion page body: an "Ingredients" heading followed by bulleted
 * list items, then an "Instructions" heading followed by numbered list items.
 *
 * Creates the content blocks for a Notion page, including headings
 * and lists. Truncates to 100 blocks to respect Notion API limits.
 *
 * @param recipe - The recipe data to build the page body from.
 * @returns An array of Notion block objects.
 */
function buildPageBody(recipe: Recipe): unknown[] {
  const blocks: unknown[] = [];

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
  return text.slice(0, maxLength - 3) + "...";
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
  databaseId: string
): Promise<void> {
  const notion = new Client({ auth: notionApiKey });

  await notion.databases.retrieve({ database_id: databaseId });

  await (notion.databases.update as Function)({
    database_id: databaseId,
    properties: {
      [PROPERTY_NAMES.NAME]: { title: {} },
      [PROPERTY_NAMES.SOURCE_URL]: { url: {} },
      [PROPERTY_NAMES.TOTAL_TIME]: { number: { format: "number" } },
      [PROPERTY_NAMES.CUISINE]: { multi_select: { options: [] } },
      [PROPERTY_NAMES.MEAL_TYPE]: {
        multi_select: {
          options: MEAL_TYPE_OPTIONS.map((name) => ({ name })),
        },
      },
      [PROPERTY_NAMES.HEALTHINESS]: { number: { format: "number" } },
    },
  });
}
