import { readFile } from "node:fs/promises";
import type { Recipe } from "@shared/api/types";
import { REQUEST_TIMEOUT_MS } from "@shared/constants";
import { ParseError, ScrapingError } from "./errors";
import { BROWSER_HEADERS } from "./parsers/shared";
import { parseRecipeFromHtml } from "./scraper/python";

// Re-export Recipe type for convenience (used by logger, tagger, process-recipe)
export type { Recipe } from "@shared/api/types";

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
		return await parseRecipeFromHtml(html, url);
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
		return await parseRecipeFromHtml(html, sourceUrl);
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
