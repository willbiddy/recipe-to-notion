import { Client } from "@notionhq/client";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

export async function createRecipePage(
  recipe: Recipe,
  tags: RecipeTags,
  notionApiKey: string,
  databaseId: string
): Promise<string> {
  const notion = new Client({ auth: notionApiKey });

  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: recipe.name } }],
    },
    "Source URL": {
      url: recipe.sourceUrl,
    },
    Cuisine: {
      multi_select: tags.cuisine.map((c) => ({ name: c })),
    },
    "Meal Type": {
      multi_select: tags.mealType.map((m) => ({ name: m })),
    },
    Difficulty: {
      number: tags.difficulty,
    },
    Healthiness: {
      number: tags.healthiness,
    },
  };

  if (recipe.totalTimeMinutes !== null) {
    properties["Total Time"] = { number: recipe.totalTimeMinutes };
  }

  if (recipe.servings) {
    properties["Servings"] = {
      rich_text: [{ text: { content: recipe.servings } }],
    };
  }

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

function buildPageBody(recipe: Recipe): unknown[] {
  const blocks: unknown[] = [];

  if (recipe.ingredients.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Ingredients" } }],
      },
    });

    for (const ingredient of recipe.ingredients) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: truncate(ingredient, 2000) } }],
        },
      });
    }
  }

  if (recipe.instructions.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Instructions" } }],
      },
    });

    for (const step of recipe.instructions) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: truncate(step, 2000) } }],
        },
      });
    }
  }

  // Notion API limits to 100 blocks per request
  return blocks.slice(0, 100);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export async function setupDatabaseViews(
  notionApiKey: string,
  databaseId: string
): Promise<void> {
  const notion = new Client({ auth: notionApiKey });

  // Verify the database exists and is accessible
  await notion.databases.retrieve({ database_id: databaseId });

  // The Notion API does not support creating views programmatically as of 2025.
  // Views must be created manually in the Notion UI.
  // However, we can update the database to ensure all required properties exist.
  // The properties field is supported by the API but missing from the v5 SDK types.
  await (notion.databases.update as Function)({
    database_id: databaseId,
    properties: {
      Name: { title: {} },
      "Source URL": { url: {} },
      "Total Time": { number: { format: "number" } },
      Servings: { rich_text: {} },
      Cuisine: { multi_select: { options: [] } },
      "Meal Type": {
        multi_select: {
          options: [
            { name: "Breakfast" },
            { name: "Lunch" },
            { name: "Dinner" },
            { name: "Snack" },
            { name: "Dessert" },
            { name: "Appetizer" },
            { name: "Side Dish" },
          ],
        },
      },
      Difficulty: { number: { format: "number" } },
      Healthiness: { number: { format: "number" } },
    },
  });
}
