import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { REQUEST_TIMEOUT_MS } from "../shared/constants.js";
import { getWebsiteName } from "../shared/url-utils.js";
import { ParseError, ScrapingError } from "./errors.js";
import { BROWSER_HEADERS } from "./parsers/headers.js";
import { extractAuthorFromHtml, parseHtml } from "./parsers/html.js";
import { parseJsonLd } from "./parsers/json-ld.js";

/**
 * Method used to extract recipe data from the page.
 */
export enum ScrapeMethod {
	JsonLd = "json-ld",
	HtmlFallback = "html-fallback",
}

/**
 * Structured recipe data extracted from a web page.
 */
export type Recipe = {
	/**
	 * Display name of the recipe.
	 */
	name: string;
	/**
	 * Original URL the recipe was scraped from.
	 */
	sourceUrl: string;
	/**
	 * Method used to extract recipe data.
	 */
	scrapeMethod: ScrapeMethod;
	/**
	 * Recipe author or source attribution.
	 * Falls back to website domain if not explicitly provided.
	 */
	author: string;
	/**
	 * Total preparation + cooking time in minutes, if available.
	 */
	totalTimeMinutes: number | null;
	/**
	 * Serving size description (e.g. "4 servings"), if available.
	 */
	servings: string | null;
	/**
	 * URL to the recipe's hero/header image for use as a Notion cover.
	 */
	imageUrl: string | null;
	/**
	 * List of ingredient strings (e.g. "2 cups flour").
	 */
	ingredients: string[];
	/**
	 * Ordered list of instruction steps.
	 */
	instructions: string[];
	/**
	 * Source description from the recipe page, if available.
	 * Used to provide AI with additional context for tagging.
	 */
	description: string | null;
	/**
	 * Cuisine type from the source (e.g., "Italian", "Mexican").
	 * Used as a hint for AI tagging, not authoritative.
	 */
	cuisine: string | null;
	/**
	 * Recipe category from the source (e.g., "appetizer", "main course").
	 * Used as a hint for AI tagging, not authoritative.
	 */
	category: string | null;
};

/**
 * Internal type for recipe data directly from parsers (before fallback logic).
 * Author may be null at this stage and will be filled in by fallback logic.
 */
export type ParsedRecipe = Omit<Recipe, "author"> & {
	author: string | null;
};

/**
 * Parses recipe data from HTML content.
 *
 * Attempts JSON-LD (schema.org/Recipe) parsing first, which works for most
 * recipe sites including paywalled ones like NYT Cooking that embed structured
 * data for SEO. Falls back to scraping microdata attributes and common CSS
 * class patterns if JSON-LD is unavailable. If author wasn't found in JSON-LD,
 * attempts HTML fallback extraction.
 *
 * @param html - The HTML content to parse.
 * @param sourceUrl - The original URL of the recipe (for reference).
 * @returns Parsed recipe data.
 * @throws If no recipe data is found.
 */
function parseRecipeFromHtml(html: string, sourceUrl: string): Recipe {
	const $ = cheerio.load(html);
	const recipe: ParsedRecipe | null = parseJsonLd($, sourceUrl) ?? parseHtml($, sourceUrl);

	if (!recipe) {
		throw new ParseError(
			`Could not extract recipe data from ${sourceUrl}. The page may be fully paywalled or not contain a recipe.`,
			sourceUrl,
		);
	}

	// Apply fallbacks to ensure author is always populated
	let finalAuthor = recipe.author;

	if (!finalAuthor) {
		finalAuthor = extractAuthorFromHtml($);
	}

	if (!finalAuthor) {
		finalAuthor = getWebsiteName(sourceUrl) ?? sourceUrl;
	}

	// Return recipe with guaranteed non-null author
	return {
		...recipe,
		author: finalAuthor,
	};
}

/**
 * Fetches a recipe URL and extracts structured data.
 *
 * @param url - The recipe page URL to scrape.
 * @returns Parsed recipe data.
 * @throws If the page cannot be fetched or no recipe data is found.
 */
export async function scrapeRecipe(url: string): Promise<Recipe> {
	const parsedUrl = new URL(url);
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				...BROWSER_HEADERS,
				Referer: `${parsedUrl.protocol}//${parsedUrl.host}/`,
			},
		});

		if (!response.ok) {
			if (response.status === 403) {
				throw new ScrapingError({
					message:
						`Failed to fetch ${url}: 403 Forbidden. This site blocks automated requests.\n` +
						`  Tip: Save the page source in your browser and use --html:\n` +
						`  bun backend/cli.ts --html ~/Downloads/recipe.html "${url}"`,
					originalUrl: url,
					statusCode: 403,
				});
			}
			throw new ScrapingError({
				message: `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
				originalUrl: url,
				statusCode: response.status,
			});
		}

		const html = await response.text();
		return parseRecipeFromHtml(html, url);
	} catch (error) {
		if (error instanceof ScrapingError || error instanceof ParseError) {
			throw error;
		}

		if (error instanceof Error && error.name === "AbortError") {
			throw new ScrapingError({
				message: `Request timeout: Failed to fetch ${url} within ${REQUEST_TIMEOUT_MS / 1000} seconds. The server may be slow or unresponsive.`,
				originalUrl: url,
				cause: error,
			});
		}

		throw new ScrapingError({
			message: `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
			originalUrl: url,
			cause: error,
		});
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Parses recipe data from a local HTML file.
 *
 * Use this when a site blocks automated requests. Save the page source
 * from your browser and pass the file path here.
 *
 * @param htmlPath - Path to the saved HTML file.
 * @param sourceUrl - The original URL of the recipe (for reference).
 * @returns Parsed recipe data.
 * @throws If the file cannot be read or no recipe data is found.
 */
export async function scrapeRecipeFromHtml(htmlPath: string, sourceUrl: string): Promise<Recipe> {
	const html = await readFile(htmlPath, "utf-8");

	try {
		return parseRecipeFromHtml(html, sourceUrl);
	} catch (error) {
		if (error instanceof ParseError) {
			throw new ParseError(
				`Could not extract recipe data from ${htmlPath}. The file may not contain valid recipe markup.`,
				sourceUrl,
				error,
			);
		}

		throw error;
	}
}
