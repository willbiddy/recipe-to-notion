#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun src/cli.ts <url>    Process a recipe and save to Notion
 */
import { Command } from "commander";
import { consola } from "consola";
import pc from "picocolors";
import { loadConfig } from "./config.js";
import { scrapeRecipe } from "./scraper.js";
import { tagRecipe } from "./tagger.js";
import { createRecipePage } from "./notion.js";

const program = new Command();

program
  .name("recipe-to-notion")
  .description("Scrape a recipe URL, generate AI scores/tags, and save to Notion")
  .version("1.0.0")
  .argument("[url]", "Recipe URL to process")
  .action(async (url: string | undefined) => {
    try {
      if (!url) {
        program.error("Please provide a recipe URL");
        return;
      }

      await runRecipePipeline(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(message);
      process.exit(1);
    }
  });

program.parse();

/**
 * Handles the main recipe pipeline: scrape -> tag -> save.
 *
 * Orchestrates the full workflow of scraping a recipe URL, generating
 * AI tags and scores, displaying the results, and saving to Notion.
 *
 * @param url - The recipe URL to process.
 */
async function runRecipePipeline(url: string): Promise<void> {
  const config = loadConfig();

  consola.start("Scraping recipe...");
  const recipe = await scrapeRecipe(url);
  consola.success(`Scraped: ${recipe.name}`);

  consola.start("Generating AI scores and tags...");
  const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
  consola.success("Tagged recipe");

  consola.box(
    [
      pc.bold(recipe.name),
      "",
      `Cuisine:     ${tags.cuisine.join(", ")}`,
      `Meal type:   ${tags.mealType.join(", ")}`,
      `Healthiness: ${tags.healthiness}/10`,
      `Total time:  ${tags.totalTimeMinutes} min`,
      `Ingredients: ${recipe.ingredients.length} items`,
      `Steps:       ${recipe.instructions.length} steps`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  consola.start("Saving to Notion...");
  const pageId = await createRecipePage(
    recipe,
    tags,
    config.NOTION_API_KEY,
    config.NOTION_DATABASE_ID
  );
  consola.success(`Saved to Notion (page ID: ${pageId})`);
}
