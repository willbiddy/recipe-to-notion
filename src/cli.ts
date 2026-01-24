#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun src/cli.ts <url> [urls...]
 */
import { Command } from "commander";
import { consola } from "consola";
import pc from "picocolors";
import { loadConfig, type Config } from "./config.js";
import { scrapeRecipe, type Recipe } from "./scraper.js";
import { tagRecipe, type RecipeTags } from "./tagger.js";
import {
  createRecipePage,
  checkForDuplicateByUrl,
  checkForDuplicateByTitle,
  getNotionPageUrl,
} from "./notion.js";

const program = new Command();

program
  .name("recipe-to-notion")
  .description("Scrape recipe URL(s), generate AI scores/tags, and save to Notion")
  .version("1.0.0")
  .argument("<urls...>", "Recipe URL(s) to process")
  .action(async (urls: string[]) => {
    const config = loadConfig();
    let succeeded = 0;
    let failed = 0;

    for (const url of urls) {
      const success = await processRecipe(url, config);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    // Show summary if multiple URLs were processed
    if (urls.length > 1) {
      consola.log("");
      consola.info(`Processed ${urls.length} recipes: ${pc.green(`${succeeded} succeeded`)}, ${pc.red(`${failed} failed`)}`);
    }

    process.exit(failed > 0 ? 1 : 0);
  });

program.parse();

/**
 * Processes a single recipe URL through the full pipeline.
 *
 * @param url - The recipe URL to process.
 * @param config - Application configuration with API keys.
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function processRecipe(url: string, config: Config): Promise<boolean> {
  try {
    // Check for URL duplicates before scraping (saves API costs)
    consola.start("Checking for duplicates...");
    const urlDuplicate = await checkForDuplicateByUrl(
      url,
      config.NOTION_API_KEY,
      config.NOTION_DATABASE_ID
    );
    if (urlDuplicate) {
      consola.warn(`Duplicate: "${urlDuplicate.title}" already exists at ${urlDuplicate.notionUrl}`);
      return false;
    }
    consola.success("No duplicate URL found");

    // Scrape the recipe
    consola.start("Scraping recipe...");
    const recipe = await scrapeRecipe(url);
    consola.success(`Scraped: ${recipe.name}`);

    // Check for title duplicates (same recipe from different URL)
    const titleDuplicate = await checkForDuplicateByTitle(
      recipe.name,
      config.NOTION_API_KEY,
      config.NOTION_DATABASE_ID
    );
    if (titleDuplicate) {
      consola.warn(`Duplicate: "${titleDuplicate.title}" already exists at ${titleDuplicate.notionUrl}`);
      return false;
    }

    // Generate AI tags
    consola.start("Generating AI scores and tags...");
    const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
    consola.success("Tagged recipe");

    printRecipeSummary(recipe, tags);

    // Save to Notion
    consola.start("Saving to Notion...");
    const pageId = await createRecipePage(
      recipe,
      tags,
      config.NOTION_API_KEY,
      config.NOTION_DATABASE_ID,
      /* skipDuplicateCheck */ true
    );
    const notionUrl = getNotionPageUrl(pageId);
    consola.success(`Saved to Notion: ${pc.underline(pc.blue(notionUrl))}`);

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    consola.error(`Failed: ${message}`);
    return false;
  }
}

/**
 * Displays a formatted summary of the scraped and tagged recipe.
 */
function printRecipeSummary(recipe: Recipe, tags: RecipeTags): void {
  const lines = [
    pc.bold(recipe.name),
    recipe.author ? `Author:      ${recipe.author}` : null,
    `Tags:        ${tags.tags.join(", ")}`,
    `Meal type:   ${tags.mealType.join(", ")}`,
    `Healthiness: ${tags.healthiness}/10`,
    `Minutes:     ${tags.totalTimeMinutes}`,
    `Ingredients: ${recipe.ingredients.length} items`,
    `Steps:       ${recipe.instructions.length} steps`,
  ];

  consola.log("");
  consola.log(lines.filter(Boolean).join("\n"));
  consola.log("");
}
