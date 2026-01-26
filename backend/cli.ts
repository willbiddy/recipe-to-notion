#!/usr/bin/env bun
/**
 * CLI entry point for recipe-to-notion.
 *
 * Usage:
 *   bun backend/cli.ts <url> [urls...]
 *   bun backend/cli.ts --html <path> <url>
 */
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { isValidHttpUrl } from "../shared/url-utils.js";
import { type Config, loadConfig } from "./config.js";
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

	return args.filter((arg): arg is string => typeof arg === "string" && isValidHttpUrl(arg));
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

		if (urls.length > 1) {
			consola.log("");
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
 * @param config - Application configuration with API keys.
 * @param htmlPath - Optional path to saved HTML file (bypasses fetching).
 * @returns True if the recipe was saved successfully, false otherwise.
 */
async function handleRecipe(url: string, _config: Config, htmlPath?: string): Promise<boolean> {
	try {
		const logger = createConsoleLogger();

		if (htmlPath) {
			consola.start(`Parsing recipe from ${htmlPath}...`);
			const recipe = await scrapeRecipeFromHtml(htmlPath, url);
			const methodLabel = recipe.scrapeMethod === "json-ld" ? "(JSON-LD)" : "(HTML fallback)";
			consola.success(`Scraped: ${recipe.name} ${methodLabel}`);

			await processRecipe({ recipe, logger });
		} else {
			await processRecipe({ url, logger });
		}

		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		consola.error(`Failed: ${message}`);
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

	if (total > 1) {
		consola.log("");
		consola.info(
			`Processed ${total} recipes: ${colors.green(`${results.succeeded} succeeded`)}, ${colors.red(`${results.failed} failed`)}`,
		);
	}
}
