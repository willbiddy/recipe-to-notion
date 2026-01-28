#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun add <url> [urls...]
 *   bun add --html <path> <url>
 */
import { defineCommand, runMain } from "citty";
import { colors } from "../shared/colors.js";
import { isString } from "../shared/type-guards.js";
import { isValidHttpUrl, stripQueryParams } from "../shared/url-utils.js";
import { loadConfig } from "./config.js";
import { createConsoleLogger } from "./logger.js";
import { processRecipe } from "./process-recipe.js";
import { scrapeRecipeFromHtml } from "./scraper.js";

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
			console.log(colors.red("Please provide at least one recipe URL"));
			process.exit(1);
		}

		if (args.html) {
			if (urls.length > 1) {
				console.log(colors.yellow("--html option only supports one URL at a time"));
			}
			const success = await handleRecipe(firstUrl, args.html);
			process.exit(success ? 0 : 1);
		}

		try {
			loadConfig();
		} catch (err) {
			console.log(colors.red(err instanceof Error ? err.message : String(err)));
			process.exit(1);
		}

		const results = await processUrlsSequentially(urls);
		printSummary(results);

		process.exit(results.failed > 0 ? 1 : 0);
	},
});

runMain(main);

/**
 * Extracts valid HTTP/HTTPS URLs from CLI arguments and strips query parameters.
 *
 * @param args - Positional arguments from the CLI.
 * @returns Array of valid HTTP/HTTPS URLs with query parameters stripped.
 */
function parseUrls(args: string[] | undefined): string[] {
	if (!args) {
		return [];
	}

	return args
		.filter((arg): arg is string => isString(arg) && isValidHttpUrl(arg))
		.map((url) => stripQueryParams(url));
}

/**
 * Processes all URLs sequentially, one at a time.
 * This ensures clean, non-interspersed output.
 *
 * @param urls - Array of recipe URLs to process.
 * @returns Object with counts of succeeded and failed recipes.
 */
async function processUrlsSequentially(
	urls: string[],
): Promise<{ succeeded: number; failed: number }> {
	if (urls.length > 1) {
		console.log(`Processing ${urls.length} recipes`);
		console.log("");
	}

	let succeeded = 0;
	let failed = 0;

	for (const [i, url] of urls.entries()) {
		if (urls.length > 1) {
			console.log(`${colors.cyan(`[${i + 1}/${urls.length}]`)} ${url}`);
		}

		const success = await handleRecipe(url);
		if (success) {
			succeeded++;
		} else {
			failed++;
		}

		if (urls.length > 1) {
			console.log("");
		}
	}

	return { succeeded, failed };
}

/**
 * Handles a single recipe URL through the full pipeline with CLI logging.
 *
 * Uses the shared processRecipe pipeline for both normal URLs and HTML file mode.
 *
 * @param url - The recipe URL to process.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function handleRecipe(url: string, htmlPath?: string): Promise<boolean> {
	try {
		const logger = createConsoleLogger();

		if (htmlPath) {
			console.log(`Parsing recipe from ${htmlPath}...`);
			const recipe = await scrapeRecipeFromHtml(htmlPath, url);
			console.log(colors.green(`Scraped: ${colors.bold(recipe.name)}`));

			await processRecipe({ recipe, logger });
		} else {
			await processRecipe({ url, logger });
		}

		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.log(colors.red(`Failed: ${message}`));
		return false;
	}
}

/**
 * Prints final summary when processing multiple recipes.
 *
 * @param results - Object with counts of succeeded and failed recipes.
 */
function printSummary(results: { succeeded: number; failed: number }): void {
	const total = results.succeeded + results.failed;

	const passed = results.succeeded && `${colors.green(`${results.succeeded} succeeded`)}`;
	const failed = results.failed && `${colors.red(`${results.failed} failed`)}`;
	const status = [passed, failed].filter(Boolean).join(" / ");

	if (total > 1) {
		console.log(`Processed ${total} recipes: ${status}`);
	}
}
