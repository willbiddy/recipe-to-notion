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
import { createRecipePage, checkForDuplicateByUrl, checkForDuplicateByTitle, getNotionPageUrl } from "./notion.js";

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

  // Check for URL duplicates before scraping to save time and API costs
  consola.start("Checking for duplicates...");
  const urlDuplicate = await checkForDuplicateByUrl(url, config.NOTION_API_KEY, config.NOTION_DATABASE_ID);
  if (urlDuplicate) {
    consola.error("\n⚠️  Duplicate recipe detected");
    consola.log(
      [
        pc.bold(pc.yellow("Recipe:")),
        `  ${urlDuplicate.title}`,
        "",
        pc.bold(pc.yellow("Source URL:")),
        `  ${urlDuplicate.url}`,
        "",
        pc.bold(pc.yellow("Notion page:")),
        `  ${pc.underline(pc.blue(urlDuplicate.notionUrl))}`,
      ].join("\n")
    );
    consola.log("");
    process.exit(1);
  }
  consola.success("No duplicate URL found");

  consola.start("Scraping recipe...");
  const recipe = await scrapeRecipe(url);
  consola.success(`Scraped: ${recipe.name}`);

  // Check for title duplicates after scraping (in case same title but different URL)
  // Skip URL check since we already checked it above
  const titleDuplicate = await checkForDuplicateByTitle(recipe.name, config.NOTION_API_KEY, config.NOTION_DATABASE_ID);
  if (titleDuplicate) {
    consola.error("\n⚠️  Duplicate recipe detected");
    consola.log(
      [
        pc.bold(pc.yellow("Recipe:")),
        `  ${titleDuplicate.title}`,
        "",
        pc.bold(pc.yellow("Source URL:")),
        `  ${titleDuplicate.url}`,
        "",
        pc.bold(pc.yellow("Notion page:")),
        `  ${pc.underline(pc.blue(titleDuplicate.notionUrl))}`,
      ].join("\n")
    );
    consola.log("");
    process.exit(1);
  }

  consola.start("Generating AI scores and tags...");
  const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
  consola.success("Tagged recipe");

  console.log("");
  consola.log(
    [
      pc.bold(recipe.name),
      recipe.author ? `Author:      ${recipe.author}` : null,
      `Tags:        ${tags.tags.join(", ")}`,
      `Meal type:   ${tags.mealType.join(", ")}`,
      `Healthiness: ${tags.healthiness}/10`,
      `Minutes:     ${tags.totalTimeMinutes}`,
      `Ingredients: ${recipe.ingredients.length} items`,
      `Steps:       ${recipe.instructions.length} steps`,
    ].filter(Boolean).join("\n")
  );
  console.log("");

  consola.start("Saving to Notion...");
  const pageId = await createRecipePage(
    recipe,
    tags,
    config.NOTION_API_KEY,
    config.NOTION_DATABASE_ID,
    true // Skip duplicate check since we already checked URL and title
  );
  const notionUrl = getNotionPageUrl(pageId);
  consola.success(`Saved to Notion: ${pc.underline(pc.blue(notionUrl))}`);
}
