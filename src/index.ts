import { scrapeRecipe } from "./scraper.js";
import { tagRecipe } from "./tagger.js";
import { createRecipePage } from "./notion.js";
import { loadConfig } from "./config.js";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

/** Result of processing a recipe URL through the full pipeline. */
export interface ProcessResult {
  /** The scraped recipe data. */
  recipe: Recipe;
  /** AI-generated tags and scores. */
  tags: RecipeTags;
  /** Notion page ID. */
  pageId: string;
}

/**
 * Orchestrates the full recipe pipeline: scrape -> tag -> save.
 *
 * @param url - Recipe page URL to process.
 * @returns The scraped recipe, generated tags, and the Notion page ID.
 */
export async function processRecipe(url: string): Promise<ProcessResult> {
  const config = loadConfig();

  const recipe = await scrapeRecipe(url);
  const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);

  const pageId = await createRecipePage(
    recipe,
    tags,
    config.NOTION_API_KEY,
    config.NOTION_DATABASE_ID
  );

  return { recipe, tags, pageId };
}
