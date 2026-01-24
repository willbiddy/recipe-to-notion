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
import ora from "ora";
import chalk from "chalk";
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
      console.error(chalk.red(`\nError: ${message}`));
      process.exit(1);
    }
  });

program.parse();

/** Handles the --setup flag: configures Notion database properties. */
async function runSetup(): Promise<void> {
  const spinner = ora("Setting up Notion database properties...").start();
  await setup();
  spinner.succeed("Database properties configured");
  console.log(
    chalk.gray(
      "\nNote: Views (Gallery, Quick Meals, Healthiest, By Cuisine, By Meal Type) should be created manually in Notion."
    )
  );
}

/** Handles the main recipe pipeline: scrape -> tag -> (optionally) save. */
async function runRecipePipeline(url: string, dryRun: boolean): Promise<void> {
  const config = loadConfig();

  // Step 1: Scrape the recipe page
  const scrapeSpinner = ora("Scraping recipe...").start();
  const recipe = await scrapeRecipe(url);
  scrapeSpinner.succeed(`Scraped: ${chalk.bold(recipe.name)}`);

  // Step 2: Generate AI scores and tags
  const tagSpinner = ora("Generating AI scores and tags...").start();
  const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
  tagSpinner.succeed("Tagged recipe");

  // Display results
  console.log();
  console.log(chalk.cyan("  Cuisine:    ") + tags.cuisine.join(", "));
  console.log(chalk.cyan("  Meal Type:  ") + tags.mealType.join(", "));
  console.log(chalk.cyan("  Difficulty: ") + `${tags.difficulty}/10`);
  console.log(chalk.cyan("  Healthiness:") + ` ${tags.healthiness}/10`);
  if (recipe.totalTimeMinutes) {
    console.log(chalk.cyan("  Total Time: ") + `${recipe.totalTimeMinutes} min`);
  }
  if (recipe.servings) {
    console.log(chalk.cyan("  Servings:   ") + recipe.servings);
  }
  console.log(chalk.cyan("  Ingredients:") + ` ${recipe.ingredients.length} items`);
  console.log(chalk.cyan("  Steps:      ") + `${recipe.instructions.length} steps`);
  console.log();

  if (dryRun) {
    console.log(chalk.yellow("Dry run — skipping Notion save."));
    return;
  }

  // Step 3: Save to Notion
  const notionSpinner = ora("Saving to Notion...").start();
  const pageId = await createRecipePage(
    recipe,
    tags,
    config.NOTION_API_KEY,
    config.NOTION_DATABASE_ID
  );
  notionSpinner.succeed(`Saved to Notion (page ID: ${pageId})`);
}
