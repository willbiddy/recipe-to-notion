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
	| { type: "checking_duplicates"; message: string }
	| { type: "scraping"; message: string }
	| { type: "tagging"; message: string }
	| { type: "saving"; message: string };

/**
 * Progress messages for each stage of recipe processing.
 */
const PROGRESS_MESSAGES = {
	checking_duplicates: "Checking for duplicates...",
	scraping: "Scraping recipe...",
	tagging: "Generating AI tags and scores...",
	saving: "Saving to Notion...",
} as const;

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

	// Step 1: Check for duplicate URL
	onProgress?.({ type: "checking_duplicates", message: PROGRESS_MESSAGES.checking_duplicates });
	logger?.onCheckingDuplicates?.();
	const urlDuplicate = await checkForDuplicateByUrl(
		url,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);
	if (urlDuplicate) {
		logger?.onDuplicateFound?.(urlDuplicate.title, urlDuplicate.notionUrl);
		throw createDuplicateError(urlDuplicate);
	}
	logger?.onNoDuplicateFound?.();

	// Step 2: Scrape recipe from URL
	onProgress?.({ type: "scraping", message: PROGRESS_MESSAGES.scraping });
	logger?.onScraping?.();
	const recipe = await scrapeRecipe(url);
	logger?.onScraped?.(recipe);

	// Step 3: Generate AI tags and scores
	onProgress?.({ type: "tagging", message: PROGRESS_MESSAGES.tagging });
	logger?.onTagging?.();
	const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
	logger?.onTagged?.();

	// Step 4: Check for duplicate title (after scraping to get accurate title)
	const titleDuplicate = await checkForDuplicateByTitle(
		recipe.name,
		config.NOTION_API_KEY,
		config.NOTION_DATABASE_ID,
	);
	if (titleDuplicate) {
		logger?.onDuplicateFound?.(titleDuplicate.title, titleDuplicate.notionUrl);
		throw createDuplicateError(titleDuplicate);
	}

	// Step 5: Save to Notion
	onProgress?.({ type: "saving", message: PROGRESS_MESSAGES.saving });
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

/**
 * Creates a standardized duplicate error message.
 *
 * @param duplicate - Duplicate recipe information.
 * @returns Error with formatted duplicate message.
 */
function createDuplicateError(duplicate: { title: string; url: string; notionUrl: string }): Error {
	return new Error(
		`Duplicate recipe found: "${duplicate.title}" (${duplicate.url}) already exists in the database. View it at: ${duplicate.notionUrl}`,
	);
}
