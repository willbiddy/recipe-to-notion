#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun src/cli.ts <url> [urls...]
 */
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import pc from "picocolors";
import { type Config, loadConfig } from "./config.js";
import {
	checkForDuplicateByTitle,
	checkForDuplicateByUrl,
	createRecipePage,
	getNotionPageUrl,
} from "./notion.js";
import {
	type Recipe,
	scrapeRecipe,
	scrapeRecipeFromHtml,
} from "./scraper.js";
import { type RecipeTags, tagRecipe } from "./tagger.js";

const main = defineCommand({
	meta: {
		name: "recipe-to-notion",
		description:
			"Scrape recipe URL(s), generate AI scores/tags, and save to Notion",
		version: "1.0.0",
	},
	args: {
		url: {
			type: "positional",
			description: "Recipe URL(s) to process",
			required: true,
		},
		html: {
			type: "string",
			description:
				"Use saved HTML file instead of fetching (for sites that block requests)",
		},
	},
	async run({ args }) {
		// Collect all URLs (first positional + any remaining args)
		const urls = [args.url, ...(args._ || [])].filter(
			(arg): arg is string => typeof arg === "string" && arg.startsWith("http"),
		);

		if (urls.length === 0) {
			consola.error("Please provide at least one recipe URL");
			process.exit(1);
		}

		const config = loadConfig();
		let succeeded = 0;
		let failed = 0;

		// If --html is provided, only process the first URL with that HTML
		if (args.html) {
			if (urls.length > 1) {
				consola.warn("--html option only supports one URL at a time");
			}
			const success = await processRecipe(urls[0], config, args.html);
			process.exit(success ? 0 : 1);
		}

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
			consola.info(
				`Processed ${urls.length} recipes: ${pc.green(`${succeeded} succeeded`)}, ${pc.red(`${failed} failed`)}`,
			);
		}

		process.exit(failed > 0 ? 1 : 0);
	},
});

runMain(main);

/**
 * Processes a single recipe URL through the full pipeline.
 *
 * @param url - The recipe URL to process.
 * @param config - Application configuration with API keys.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function processRecipe(
	url: string,
	config: Config,
	htmlPath?: string,
): Promise<boolean> {
	try {
		// Check for URL duplicates before scraping (saves API costs)
		consola.start("Checking for duplicates...");
		const urlDuplicate = await checkForDuplicateByUrl(
			url,
			config.NOTION_API_KEY,
			config.NOTION_DATABASE_ID,
		);
		if (urlDuplicate) {
			consola.warn(
				`Duplicate: "${urlDuplicate.title}" already exists at ${urlDuplicate.notionUrl}`,
			);
			return false;
		}
		consola.success("No duplicate URL found");

		// Scrape the recipe (from HTML file or by fetching)
		consola.start(
			htmlPath ? `Parsing recipe from ${htmlPath}...` : "Scraping recipe...",
		);
		const recipe = htmlPath
			? await scrapeRecipeFromHtml(htmlPath, url)
			: await scrapeRecipe(url);
		consola.success(`Scraped: ${recipe.name}`);

		// Check for title duplicates (same recipe from different URL)
		const titleDuplicate = await checkForDuplicateByTitle(
			recipe.name,
			config.NOTION_API_KEY,
			config.NOTION_DATABASE_ID,
		);
		if (titleDuplicate) {
			consola.warn(
				`Duplicate: "${titleDuplicate.title}" already exists at ${titleDuplicate.notionUrl}`,
			);
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
			/* skipDuplicateCheck */ true,
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
