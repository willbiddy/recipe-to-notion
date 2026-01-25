#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun src/cli.ts <url> [urls...]
 *   bun src/cli.ts --html <path> <url>
 */
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { type Config, loadConfig } from "./config.js";
import { processRecipe } from "./index.js";
import { createCliLogger, printRecipeSummary } from "./logger.js";
import {
	checkForDuplicateByTitle,
	checkForDuplicateByUrl,
	createRecipePage,
	getNotionPageUrl,
} from "./notion.js";
import { type Recipe, scrapeRecipe, scrapeRecipeFromHtml } from "./scraper.js";
import { type RecipeTags, tagRecipe } from "./tagger.js";

// ─────────────────────────────────────────────────────────────────────────────
// CLI Definition
// ─────────────────────────────────────────────────────────────────────────────

const main = defineCommand({
	meta: {
		name: "recipe-to-notion",
		description: "Scrape recipe URL(s), generate AI scores/tags, and save to Notion",
		version: "1.0.0",
	},
	args: {
		html: {
			type: "string",
			description: "Use saved HTML file instead of fetching (for sites that block requests)",
		},
	},
	async run({ args }) {
		const urls = parseUrls(args._);
		const firstUrl = urls[0];

		if (!firstUrl) {
			consola.error("Please provide at least one recipe URL");
			process.exit(1);
		}

		let config: Config;
		try {
			config = loadConfig();
		} catch (err) {
			consola.fatal(err instanceof Error ? err.message : String(err));
			process.exit(1);
		}

		/**
		 * Handle --html flag (single URL only).
		 */
		if (args.html) {
			if (urls.length > 1) {
				consola.warn("--html option only supports one URL at a time");
			}
			const success = await handleRecipe(firstUrl, config, args.html);
			process.exit(success ? 0 : 1);
		}

		const results = await processUrlsSequentially(urls, config);
		printSummary(results);

		process.exit(results.failed > 0 ? 1 : 0);
	},
});

runMain(main);

// ─────────────────────────────────────────────────────────────────────────────
// URL Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts valid HTTP/HTTPS URLs from CLI arguments.
 *
 * @param args - Positional arguments from the CLI.
 * @returns Array of valid HTTP/HTTPS URLs.
 */
function parseUrls(args: string[] | undefined): string[] {
	if (!args) {
		return [];
	}

	return args.filter(
		(arg): arg is string =>
			typeof arg === "string" && (arg.startsWith("http://") || arg.startsWith("https://")),
	);
}

/**
 * Processes all URLs sequentially, one at a time.
 * This ensures clean, non-interspersed output.
 *
 * @param urls - Array of recipe URLs to process.
 * @param config - Application configuration with API keys.
 * @returns Object with counts of succeeded and failed recipes.
 */
async function processUrlsSequentially(
	urls: string[],
	config: Config,
): Promise<{ succeeded: number; failed: number }> {
	if (urls.length > 1) {
		consola.ready(`Processing ${urls.length} recipes sequentially`);
	} else {
		consola.ready("Processing recipe");
	}

	let succeeded = 0;
	let failed = 0;

	for (const [i, url] of urls.entries()) {
		if (urls.length > 1) {
			consola.info(`${colors.cyan(`[${i + 1}/${urls.length}]`)} ${colors.dim(url)}`);
		}

		const success = await handleRecipe(url, config);
		if (success) {
			succeeded++;
		} else {
			failed++;
		}

		if (urls.length > 1 && i < urls.length - 1) {
			console.log();
		}
	}

	return { succeeded, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Recipe Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles a single recipe URL through the full pipeline with CLI logging.
 *
 * For HTML file mode, uses the legacy pipeline with manual steps. For normal URLs,
 * uses the shared processRecipe pipeline.
 *
 * @param url - The recipe URL to process.
 * @param config - Application configuration with API keys.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function handleRecipe(url: string, config: Config, htmlPath?: string): Promise<boolean> {
	try {
		if (htmlPath) {
			return await handleRecipeFromHtml(url, htmlPath, config);
		}

		const logger = createCliLogger();
		const result = await processRecipe(url, undefined, logger);
		printRecipeSummary(result.recipe, result.tags);
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		consola.error(`Failed: ${message}`);
		return false;
	}
}

/**
 * Handles recipe processing from a saved HTML file (legacy mode).
 *
 * This bypasses the shared pipeline to support the --html flag. Processing steps:
 * 1. Check for duplicate URL
 * 2. Fetch and parse recipe from HTML file
 * 3. Check for duplicate title
 * 4. Generate AI tags
 * 5. Save to Notion
 *
 * @param url - The recipe URL (for reference).
 * @param htmlPath - Path to saved HTML file.
 * @param config - Application configuration with API keys.
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function handleRecipeFromHtml(
	url: string,
	htmlPath: string,
	config: Config,
): Promise<boolean> {
	consola.start("Checking for duplicates...");
	const urlDuplicate = await checkForDuplicateByUrl(
		url,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);

	if (urlDuplicate) {
		consola.warn(`Duplicate: "${urlDuplicate.title}" already exists at ${urlDuplicate.notionUrl}`);
		return false;
	}
	consola.success("No duplicate URL found");

	const recipe = await fetchRecipe(url, htmlPath);

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

	const tags = await generateTags(recipe, config);
	printRecipeSummary(recipe, tags);

	await saveToNotion(recipe, tags, config);
	return true;
}

/**
 * Fetches and parses recipe data from URL or local HTML file.
 *
 * @param url - The recipe URL to scrape.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns Parsed recipe data.
 */
async function fetchRecipe(url: string, htmlPath?: string): Promise<Recipe> {
	consola.start(htmlPath ? `Parsing recipe from ${htmlPath}...` : "Scraping recipe...");

	const recipe = htmlPath ? await scrapeRecipeFromHtml(htmlPath, url) : await scrapeRecipe(url);

	const methodLabel = recipe.scrapeMethod === "json-ld" ? "(JSON-LD)" : "(HTML fallback)";
	consola.success(`Scraped: ${recipe.name} ${methodLabel}`);
	return recipe;
}

/**
 * Generates AI tags and scores for a recipe.
 *
 * @param recipe - The scraped recipe to analyze.
 * @param config - Application configuration with API keys.
 * @returns AI-generated tags and scores for the recipe.
 */
async function generateTags(recipe: Recipe, config: Config): Promise<RecipeTags> {
	consola.start("Generating AI scores and tags...");
	const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
	consola.success("Tagged recipe");
	return tags;
}

/**
 * Saves a recipe to Notion and logs the resulting URL.
 *
 * @param recipe - The scraped recipe data.
 * @param tags - AI-generated tags and scores.
 * @param config - Application configuration with API keys.
 */
async function saveToNotion(recipe: Recipe, tags: RecipeTags, config: Config): Promise<void> {
	consola.start("Saving to Notion...");

	const pageId = await createRecipePage({
		recipe,
		tags,
		notionApiKey: config.NOTION_API_KEY,
		databaseId: config.NOTION_DATABASE_ID,
		skipDuplicateCheck: true,
	});

	const notionUrl = getNotionPageUrl(pageId);
	consola.success(`Saved to Notion: ${colors.underline(colors.blue(notionUrl))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prints final summary when processing multiple recipes.
 *
 * @param results - Object with counts of succeeded and failed recipes.
 */
function printSummary(results: { succeeded: number; failed: number }): void {
	const total = results.succeeded + results.failed;

	if (total > 1) {
		console.log();
		consola.info(
			`Processed ${total} recipes: ${colors.green(`${results.succeeded} succeeded`)}, ${colors.red(`${results.failed} failed`)}`,
		);
	}
}
