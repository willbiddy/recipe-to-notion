#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun src/cli.ts <url>              Process a recipe and save to Notion
 *   bun src/cli.ts --dry-run <url>    Scrape + tag without saving
 *   bun src/cli.ts --setup            Initialize database properties
 */
import { Command } from "commander";
import { consola } from "consola";
import { loadConfig } from "./config.js";
import { scrapeRecipe } from "./scraper.js";
import { tagRecipe } from "./tagger.js";
import { createRecipePage } from "./notion.js";
import { setup } from "./index.js";

const program = new Command();

program
  .name("recipe-to-notion")
  .description("Scrape a recipe URL, generate AI scores/tags, and save to Notion")
  .version("1.0.0")
  .argument("[url]", "Recipe URL to process")
  .option("--dry-run", "Parse and tag the recipe without saving to Notion")
  .option("--setup", "Initialize database properties")
  .action(async (url: string | undefined, options: { dryRun?: boolean; setup?: boolean }) => {
    try {
      if (options.setup) {
        await runSetup();
        return;
      }

      if (!url) {
        program.error("Please provide a recipe URL or use --setup");
        return;
      }

      await runRecipePipeline(url, options.dryRun ?? false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(message);
      process.exit(1);
    }
  });

program.parse();

/** Handles the --setup flag: configures Notion database properties. */
async function runSetup(): Promise<void> {
  consola.start("Setting up Notion database properties...");
  await setup();
  consola.success("Database properties configured");
  consola.info(
    "Views (Gallery, Quick Meals, Healthiest, By Cuisine, By Meal Type) should be created manually in Notion."
  );
}

/** Handles the main recipe pipeline: scrape -> tag -> (optionally) save. */
async function runRecipePipeline(url: string, dryRun: boolean): Promise<void> {
  const config = loadConfig();

  // Step 1: Scrape the recipe page
  consola.start("Scraping recipe...");
  const recipe = await scrapeRecipe(url);
  consola.success(`Scraped: ${recipe.name}`);

  // Step 2: Generate AI scores and tags
  consola.start("Generating AI scores and tags...");
  const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
  consola.success("Tagged recipe");

  // Display results
  consola.box(
    [
      `${recipe.name}`,
      "",
      `Cuisine:     ${tags.cuisine.join(", ")}`,
      `Meal Type:   ${tags.mealType.join(", ")}`,
      `Difficulty:  ${tags.difficulty}/10`,
      `Healthiness: ${tags.healthiness}/10`,
      recipe.totalTimeMinutes ? `Total Time:  ${recipe.totalTimeMinutes} min` : null,
      recipe.servings ? `Servings:    ${recipe.servings}` : null,
      `Ingredients: ${recipe.ingredients.length} items`,
      `Steps:       ${recipe.instructions.length} steps`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (dryRun) {
    consola.warn("Dry run — skipping Notion save.");
    return;
  }

  // Step 3: Save to Notion
  consola.start("Saving to Notion...");
  const pageId = await createRecipePage(
    recipe,
    tags,
    config.NOTION_API_KEY,
    config.NOTION_DATABASE_ID
  );
  consola.success(`Saved to Notion (page ID: ${pageId})`);
}
