import { scrapeRecipe } from "./scraper.js";
import { tagRecipe } from "./tagger.js";
import { createRecipePage, setupDatabaseViews } from "./notion.js";
import { loadConfig } from "./config.js";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

export interface ProcessResult {
  recipe: Recipe;
  tags: RecipeTags;
  pageId?: string;
}

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

export async function setup(): Promise<void> {
  const config = loadConfig();
  await setupDatabaseViews(config.NOTION_API_KEY, config.NOTION_DATABASE_ID);
}
