import { loadConfig } from "./config.js";
import { checkForDuplicateByTitle, checkForDuplicateByUrl, createRecipePage } from "./notion.js";
import type { Recipe } from "./scraper.js";
import { scrapeRecipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";
import { tagRecipe } from "./tagger.js";

/**
 * Result of processing a recipe URL through the full pipeline.
 */
export interface ProcessResult {
	/**
	 * The scraped recipe data.
	 */
	recipe: Recipe;
	/**
	 * AI-generated tags and scores.
	 */
	tags: RecipeTags;
	/**
	 * Notion page ID.
	 */
	pageId: string;
}

/**
 * Orchestrates the full recipe pipeline: scrape -> tag -> save.
 *
 * @param url - Recipe page URL to process.
 * @returns The scraped recipe, generated tags, and the Notion page ID.
 * @throws If a duplicate recipe (same title or URL) already exists.
 */
export async function processRecipe(url: string): Promise<ProcessResult> {
	const config = loadConfig();

	// Check for URL duplicates before scraping to save time and API costs
	const urlDuplicate = await checkForDuplicateByUrl(
		url,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);
	if (urlDuplicate) {
		throw new Error(
			`Duplicate recipe found: "${urlDuplicate.title}" (${urlDuplicate.url}) already exists in the database. View it at: ${urlDuplicate.notionUrl}`,
		);
	}

	const recipe = await scrapeRecipe(url);
	const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);

	// Check for title duplicates after scraping (in case same title but different URL)
	// Skip URL check since we already checked it above
	const titleDuplicate = await checkForDuplicateByTitle(
		recipe.name,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);
	if (titleDuplicate) {
		throw new Error(
			`Duplicate recipe found: "${titleDuplicate.title}" (${titleDuplicate.url}) already exists in the database. View it at: ${titleDuplicate.notionUrl}`,
		);
	}

	const pageId = await createRecipePage(
		recipe,
		tags,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
		true, // Skip duplicate check since we already checked URL and title
	);

	return { recipe, tags, pageId };
}
