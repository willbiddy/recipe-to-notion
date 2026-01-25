import * as cheerio from "cheerio";
import { extractAuthorFromHtml, parseHtml } from "./parsers/html.js";
import { parseJsonLd } from "./parsers/json-ld.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Browser-like HTTP headers to avoid bot detection.
 */
const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	Accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
	"Accept-Encoding": "gzip, deflate, br",
	"Cache-Control": "no-cache",
	Connection: "keep-alive",
	DNT: "1",
	Pragma: "no-cache",
	"Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
	"Sec-Ch-Ua-Mobile": "?0",
	"Sec-Ch-Ua-Platform": '"macOS"',
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "none",
	"Sec-Fetch-User": "?1",
	"Upgrade-Insecure-Requests": "1",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Method used to extract recipe data from the page.
 */
export type ScrapeMethod = "json-ld" | "html-fallback";

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
	 * Recipe author or source attribution, if available.
	 */
	author: string | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Main functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses recipe data from HTML content.
 *
 * Attempts JSON-LD (schema.org/Recipe) parsing first, which works for most
 * recipe sites including paywalled ones like NYT Cooking that embed structured
 * data for SEO. Falls back to scraping microdata attributes and common CSS
 * class patterns if JSON-LD is unavailable.
 *
 * @param html - The HTML content to parse.
 * @param sourceUrl - The original URL of the recipe (for reference).
 * @returns Parsed recipe data.
 * @throws If no recipe data is found.
 */
function parseRecipeFromHtml(html: string, sourceUrl: string): Recipe {
	const $ = cheerio.load(html);
	const recipe = parseJsonLd($, sourceUrl) ?? parseHtml($, sourceUrl);

	if (!recipe) {
		throw new Error(
			`Could not extract recipe data from ${sourceUrl}. The page may be fully paywalled or not contain a recipe.`,
		);
	}

	/**
	 * If author wasn't found in JSON-LD, try HTML fallback.
	 */
	if (!recipe.author) {
		recipe.author = extractAuthorFromHtml($);
	}

	return recipe;
}

/**
 * Request timeout in milliseconds (30 seconds).
 * Prevents DoS attacks via slow responses or resource exhaustion.
 */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Fetches a recipe URL and extracts structured data.
 *
 * Attempts JSON-LD (schema.org/Recipe) parsing first, which works for most
 * recipe sites including paywalled ones like NYT Cooking that embed structured
 * data for SEO. Falls back to scraping microdata attributes and common CSS
 * class patterns if JSON-LD is unavailable.
 *
 * @param url - The recipe page URL to scrape.
 * @returns Parsed recipe data.
 * @throws If the page cannot be fetched or no recipe data is found.
 */
export async function scrapeRecipe(url: string): Promise<Recipe> {
	const parsedUrl = new URL(url);

	// Set up timeout to prevent DoS attacks
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
				throw new Error(
					`Failed to fetch ${url}: 403 Forbidden. This site blocks automated requests.\n` +
						`  Tip: Save the page source in your browser and use --html:\n` +
						`  bun src/cli.ts --html ~/Downloads/recipe.html "${url}"`,
				);
			}
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		const html = await response.text();
		return parseRecipeFromHtml(html, url);
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error(
				`Request timeout: Failed to fetch ${url} within ${REQUEST_TIMEOUT_MS / 1000} seconds. The server may be slow or unresponsive.`,
			);
		}
		throw error;
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
	const file = Bun.file(htmlPath);
	const html = await file.text();

	try {
		return parseRecipeFromHtml(html, sourceUrl);
	} catch (error) {
		if (error instanceof Error && error.message.includes("Could not extract recipe data")) {
			throw new Error(
				`Could not extract recipe data from ${htmlPath}. The file may not contain valid recipe markup.`,
			);
		}
		throw error;
	}
}
