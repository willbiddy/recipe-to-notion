import { loadConfig } from "./config.js";
import { DuplicateRecipeError } from "./errors.js";
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
export enum ProgressType {
	CHECKING_DUPLICATES = "checking_duplicates",
	SCRAPING = "scraping",
	TAGGING = "tagging",
	SAVING = "saving",
	STARTING = "starting",
}

/**
 * Progress event types during recipe processing.
 */
export type ProgressEvent =
	| { type: ProgressType.CHECKING_DUPLICATES; message: string }
	| { type: ProgressType.SCRAPING; message: string }
	| { type: ProgressType.TAGGING; message: string }
	| { type: ProgressType.SAVING; message: string };

/**
 * Progress messages for each stage of recipe processing.
 */
const PROGRESS_MESSAGES = {
	[ProgressType.CHECKING_DUPLICATES]: "Checking for duplicates...",
	[ProgressType.SCRAPING]: "Scraping recipe...",
	[ProgressType.TAGGING]: "Generating AI tags and scores...",
	[ProgressType.SAVING]: "Saving to Notion...",
} as const;

/**
 * Progress callback function type.
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Orchestrates the full recipe pipeline: scrape -> tag -> save.
 *
 * Processing steps:
 * 1. Check for duplicate URL (early detection before scraping)
 * 2. Scrape recipe from URL
 * 3. Generate AI tags and scores using Claude
 * 4. Check for duplicate title (after scraping to get accurate title)
 * 5. Save to Notion with recipe metadata, ingredients, and instructions
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

	onProgress?.({
		type: ProgressType.CHECKING_DUPLICATES,
		message: PROGRESS_MESSAGES[ProgressType.CHECKING_DUPLICATES],
	});
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

	onProgress?.({ type: ProgressType.SCRAPING, message: PROGRESS_MESSAGES[ProgressType.SCRAPING] });
	logger?.onScraping?.();
	const recipe = await scrapeRecipe(url);
	logger?.onScraped?.(recipe);

	onProgress?.({ type: ProgressType.TAGGING, message: PROGRESS_MESSAGES[ProgressType.TAGGING] });
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
		throw createDuplicateError(titleDuplicate);
	}

	onProgress?.({ type: ProgressType.SAVING, message: PROGRESS_MESSAGES[ProgressType.SAVING] });
	logger?.onSaving?.();
	const pageId = await createRecipePage({
		recipe,
		tags,
		notionApiKey: config.NOTION_API_KEY,
		databaseId: config.NOTION_DATABASE_ID,
		skipDuplicateCheck: true,
	});

	const notionUrl = getNotionPageUrl(pageId);
	logger?.onSaved?.(notionUrl);

	return { recipe, tags, pageId };
}

/**
 * Creates a standardized duplicate error.
 *
 * @param duplicate - Duplicate recipe information.
 * @returns DuplicateRecipeError with structured metadata.
 */
function createDuplicateError(duplicate: {
	title: string;
	url: string;
	notionUrl: string;
}): DuplicateRecipeError {
	return new DuplicateRecipeError(duplicate.title, duplicate.url, duplicate.notionUrl);
}
