import { loadConfig } from "./config.js";
import type { RecipeLogger } from "./logger.js";
import {
	checkForDuplicateByTitle,
	checkForDuplicateByUrl,
	createRecipePage,
	getNotionPageUrl,
} from "./notion.js";
import type { Recipe } from "./scraper.js";
import { scrapeRecipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";
import { tagRecipe } from "./tagger.js";

/**
 * Result of processing a recipe URL through the full pipeline.
 */
export type ProcessResult = {
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
};

/**
 * Progress event types during recipe processing.
 */
export type ProgressEvent =
	| { type: "checking_duplicates"; message: "Checking for duplicates..." }
	| { type: "scraping"; message: "Scraping recipe..." }
	| { type: "tagging"; message: "Generating AI tags and scores..." }
	| { type: "saving"; message: "Saving to Notion..." };

/**
 * Progress callback function type.
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Orchestrates the full recipe pipeline: scrape -> tag -> save.
 *
 * @param url - Recipe page URL to process.
 * @param onProgress - Optional callback for progress updates (for SSE/streaming).
 * @param logger - Optional logger for detailed step-by-step logging.
 * @returns The scraped recipe, generated tags, and the Notion page ID.
 * @throws If a duplicate recipe (same title or URL) already exists.
 */
export async function processRecipe(
	url: string,
	onProgress?: ProgressCallback,
	logger?: RecipeLogger,
): Promise<ProcessResult> {
	const config = loadConfig();

	logger?.onStart?.();

	onProgress?.({ type: "checking_duplicates", message: "Checking for duplicates..." });
	logger?.onCheckingDuplicates?.();
	const urlDuplicate = await checkForDuplicateByUrl(
		url,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);
	if (urlDuplicate) {
		logger?.onDuplicateFound?.(urlDuplicate.title, urlDuplicate.notionUrl);
		throw new Error(
			`Duplicate recipe found: "${urlDuplicate.title}" (${urlDuplicate.url}) already exists in the database. View it at: ${urlDuplicate.notionUrl}`,
		);
	}
	logger?.onNoDuplicateFound?.();

	onProgress?.({ type: "scraping", message: "Scraping recipe..." });
	logger?.onScraping?.();
	const recipe = await scrapeRecipe(url);
	logger?.onScraped?.(recipe);

	onProgress?.({ type: "tagging", message: "Generating AI tags and scores..." });
	logger?.onTagging?.();
	const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
	logger?.onTagged?.();

	const titleDuplicate = await checkForDuplicateByTitle(
		recipe.name,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);
	if (titleDuplicate) {
		logger?.onDuplicateFound?.(titleDuplicate.title, titleDuplicate.notionUrl);
		throw new Error(
			`Duplicate recipe found: "${titleDuplicate.title}" (${titleDuplicate.url}) already exists in the database. View it at: ${titleDuplicate.notionUrl}`,
		);
	}

	onProgress?.({ type: "saving", message: "Saving to Notion..." });
	logger?.onSaving?.();
	const pageId = await createRecipePage(
		recipe,
		tags,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
		true,
	);

	const notionUrl = getNotionPageUrl(pageId);
	logger?.onSaved?.(notionUrl);

	return { recipe, tags, pageId };
}
