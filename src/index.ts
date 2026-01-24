import { scrapeRecipe } from "./scraper.js";
import { tagRecipe } from "./tagger.js";
import { createRecipePage, setupDatabaseViews } from "./notion.js";
import { loadConfig } from "./config.js";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

/** Result of processing a recipe URL through the full pipeline. */
export interface ProcessResult {
  /** The scraped recipe data. */
  recipe: Recipe;
  /** AI-generated tags and scores. */
  tags: RecipeTags;
  /** Notion page ID, present only when not in dry-run mode. */
  pageId?: string;
}

/**
 * Orchestrates the full recipe pipeline: scrape -> tag -> save.
 *
 * @param url - Recipe page URL to process.
 * @param options.dryRun - If true, skips saving to Notion and returns after tagging.
 * @returns The scraped recipe, generated tags, and (optionally) the Notion page ID.
 */
export async function processRecipe(
  url: string,
  options: { dryRun?: boolean } = {}
): Promise<ProcessResult> {
  const config = loadConfig();

  const recipe = await scrapeRecipe(url);
  const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);

  if (options.dryRun) {
    return { recipe, tags };
  }

  const pageId = await createRecipePage(
    recipe,
    tags,
    config.NOTION_API_KEY,
    config.NOTION_DATABASE_ID
  );

  return { recipe, tags, pageId };
}

/**
 * Initializes the Notion database schema by ensuring all required
 * properties exist with the correct types.
 */
export async function setup(): Promise<void> {
  const config = loadConfig();
  await setupDatabaseViews(config.NOTION_API_KEY, config.NOTION_DATABASE_ID);
}
