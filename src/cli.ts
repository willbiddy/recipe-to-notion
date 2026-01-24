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
import { type Recipe, scrapeRecipe, scrapeRecipeFromHtml } from "./scraper.js";
import { type RecipeTags, tagRecipe } from "./tagger.js";

// ─────────────────────────────────────────────────────────────────────────────
// CLI Definition
// ─────────────────────────────────────────────────────────────────────────────

const main = defineCommand({
	meta: {
		name: "recipe-to-notion",
		description:
			"Scrape recipe URL(s), generate AI scores/tags, and save to Notion",
		version: "1.0.0",
	},
	args: {
		html: {
			type: "string",
			description:
				"Use saved HTML file instead of fetching (for sites that block requests)",
		},
	},
	async run({ args }) {
		const urls = parseUrls(args._);

		if (urls.length === 0) {
			consola.error("Please provide at least one recipe URL");
			process.exit(1);
		}

		const config = loadConfig();

		// Handle --html flag (single URL only)
		if (args.html) {
			if (urls.length > 1) {
				consola.warn("--html option only supports one URL at a time");
			}
			const success = await handleRecipe(urls[0], config, args.html);
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
 * Extracts valid HTTP URLs from CLI arguments.
 *
 * @param args - Positional arguments from the CLI.
 * @returns Array of valid HTTP/HTTPS URLs.
 */
function parseUrls(args: string[] | undefined): string[] {
	return (args || []).filter(
		(arg): arg is string => typeof arg === "string" && arg.startsWith("http"),
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
		consola.info(`Processing ${urls.length} recipes sequentially\n`);
	}

	let succeeded = 0;
	let failed = 0;

	for (let i = 0; i < urls.length; i++) {
		if (urls.length > 1) {
			consola.info(
				pc.cyan(`[${i + 1}/${urls.length}]`) + ` ${pc.dim(urls[i])}`,
			);
		}

		const success = await handleRecipe(urls[i], config);
		if (success) {
			succeeded++;
		} else {
			failed++;
		}

		// Add spacing between recipes (except after the last one)
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
 * Handles a single recipe URL through the full pipeline with CLI logging:
 * duplicate check → scrape → AI tag → save to Notion.
 *
 * @param url - The recipe URL to process.
 * @param config - Application configuration with API keys.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function handleRecipe(
	url: string,
	config: Config,
	htmlPath?: string,
): Promise<boolean> {
	try {
		if (await isDuplicate(url, config)) {
			return false;
		}

		const recipe = await fetchRecipe(url, htmlPath);

		if (await isTitleDuplicate(recipe.name, config)) {
			return false;
		}

		const tags = await generateTags(recipe, config);
		printRecipeSummary(recipe, tags);

		await saveToNotion(recipe, tags, config);
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		consola.error(`Failed: ${message}`);
		return false;
	}
}

/**
 * Checks if a recipe URL already exists in Notion.
 *
 * @param url - Recipe URL to check for duplicates.
 * @param config - Application configuration with API keys.
 * @returns True if a duplicate exists, false otherwise.
 */
async function isDuplicate(url: string, config: Config): Promise<boolean> {
	consola.start("Checking for duplicates...");

	const duplicate = await checkForDuplicateByUrl(
		url,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);

	if (duplicate) {
		consola.warn(
			`Duplicate: "${duplicate.title}" already exists at ${duplicate.notionUrl}`,
		);
		return true;
	}

	consola.success("No duplicate URL found");
	return false;
}

/**
 * Checks if a recipe with the same title already exists in Notion.
 *
 * @param title - Recipe title to check for duplicates.
 * @param config - Application configuration with API keys.
 * @returns True if a duplicate exists, false otherwise.
 */
async function isTitleDuplicate(
	title: string,
	config: Config,
): Promise<boolean> {
	const duplicate = await checkForDuplicateByTitle(
		title,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);

	if (duplicate) {
		consola.warn(
			`Duplicate: "${duplicate.title}" already exists at ${duplicate.notionUrl}`,
		);
		return true;
	}

	return false;
}

/**
 * Fetches and parses recipe data from URL or local HTML file.
 *
 * @param url - The recipe URL to scrape.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns Parsed recipe data.
 */
async function fetchRecipe(url: string, htmlPath?: string): Promise<Recipe> {
	consola.start(
		htmlPath ? `Parsing recipe from ${htmlPath}...` : "Scraping recipe...",
	);

	const recipe = htmlPath
		? await scrapeRecipeFromHtml(htmlPath, url)
		: await scrapeRecipe(url);

	const methodLabel =
		recipe.scrapeMethod === "json-ld" ? "(JSON-LD)" : "(HTML fallback)";
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
async function generateTags(
	recipe: Recipe,
	config: Config,
): Promise<RecipeTags> {
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
async function saveToNotion(
	recipe: Recipe,
	tags: RecipeTags,
	config: Config,
): Promise<void> {
	consola.start("Saving to Notion...");

	const pageId = await createRecipePage(
		recipe,
		tags,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
		true, // skipDuplicateCheck - already checked above
	);

	const notionUrl = getNotionPageUrl(pageId);
	consola.success(`Saved to Notion: ${pc.underline(pc.blue(notionUrl))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Displays a formatted summary of the scraped and tagged recipe.
 *
 * @param recipe - The scraped recipe data.
 * @param tags - AI-generated tags and scores.
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

	console.log();
	console.log(lines.filter(Boolean).join("\n"));
}

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
			`Processed ${total} recipes: ${pc.green(`${results.succeeded} succeeded`)}, ${pc.red(`${results.failed} failed`)}`,
		);
	}
}
