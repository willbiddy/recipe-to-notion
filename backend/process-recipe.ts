import { getNotionConfig, loadConfig } from "./config.js";
import { DuplicateRecipeError } from "./errors.js";
import type { RecipeLogger } from "./logger.js";
import { getNotionPageUrl } from "./notion/client.js";
import { checkForDuplicateByTitle, checkForDuplicateByUrl } from "./notion/duplicates.js";
import { createRecipePage } from "./notion/page.js";
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
	CheckingDuplicates = "checking_duplicates",
	Scraping = "scraping",
	Tagging = "tagging",
	Saving = "saving",
}

/**
 * Progress event types during recipe processing.
 */
export type ProgressEvent =
	| { type: ProgressType.CheckingDuplicates; message: string }
	| { type: ProgressType.Scraping; message: string }
	| { type: ProgressType.Tagging; message: string }
	| { type: ProgressType.Saving; message: string };

/**
 * Progress messages for each stage of recipe processing.
 */
const PROGRESS_MESSAGES = {
	[ProgressType.CheckingDuplicates]: "Checking for duplicates...",
	[ProgressType.Scraping]: "Scraping recipe...",
	[ProgressType.Tagging]: "Generating tags...",
	[ProgressType.Saving]: "Saving to Notion...",
} as const;

/**
 * Progress callback function type.
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Options for processing a recipe.
 */
export type ProcessRecipeOptions = {
	/**
	 * Recipe page URL to process (required if recipe is not provided).
	 */
	url?: string;
	/**
	 * Pre-scraped recipe data (if provided, skips scraping step).
	 */
	recipe?: Recipe;
	/**
	 * Optional callback for progress updates (for SSE/streaming).
	 */
	onProgress?: ProgressCallback;
	/**
	 * Optional logger for detailed step-by-step logging.
	 */
	logger?: RecipeLogger;
};

/**
 * Orchestrates the full recipe pipeline: scrape -> tag -> save.
 *
 * Processing steps:
 * 1. Check for duplicate URL (early detection before scraping)
 * 2. Scrape recipe from URL (or use provided recipe)
 * 3. Generate AI tags and scores using Claude
 * 4. Check for duplicate title (after scraping to get accurate title)
 * 5. Save to Notion with recipe metadata, ingredients, and instructions
 *
 * @param options - Options for processing the recipe.
 * @returns The scraped recipe, generated tags, and the Notion page ID.
 * @throws If a duplicate recipe (same title or URL) already exists.
 */
export async function processRecipe(options: ProcessRecipeOptions): Promise<ProcessResult> {
	const {
		url,
		recipe: providedRecipe,
		onProgress: progressCallback,
		logger: recipeLogger,
	} = options;

	if (!url && !providedRecipe) {
		throw new Error("Either url or recipe must be provided");
	}

	const config = loadConfig();
	const notionConfig = getNotionConfig(config);

	recipeLogger?.onStart?.();

	const recipeUrl = url || providedRecipe?.sourceUrl;
	if (!recipeUrl) {
		throw new Error("Recipe URL is required for duplicate checking");
	}

	progressCallback?.({
		type: ProgressType.CheckingDuplicates,
		message: PROGRESS_MESSAGES[ProgressType.CheckingDuplicates],
	});
	recipeLogger?.onCheckingDuplicates?.();
	const urlDuplicate = await checkForDuplicateByUrl({
		url: recipeUrl,
		...notionConfig,
	});

	checkAndThrowIfDuplicate(urlDuplicate, recipeLogger);
	recipeLogger?.onNoDuplicateFound?.();

	let recipe: Recipe;
	if (providedRecipe) {
		recipe = providedRecipe;
		recipeLogger?.onScraped?.(recipe);
	} else if (url) {
		progressCallback?.({
			type: ProgressType.Scraping,
			message: PROGRESS_MESSAGES[ProgressType.Scraping],
		});
		recipeLogger?.onScraping?.();
		recipe = await scrapeRecipe(url);
		recipeLogger?.onScraped?.(recipe);
	} else {
		throw new Error("Either url or recipe must be provided");
	}

	progressCallback?.({
		type: ProgressType.Tagging,
		message: PROGRESS_MESSAGES[ProgressType.Tagging],
	});
	recipeLogger?.onTagging?.();
	const tags = await tagRecipe(recipe, config.ANTHROPIC_API_KEY);
	recipeLogger?.onTagged?.();

	const titleDuplicate = await checkForDuplicateByTitle({
		recipeName: recipe.name,
		...notionConfig,
	});

	checkAndThrowIfDuplicate(titleDuplicate, recipeLogger);

	progressCallback?.({
		type: ProgressType.Saving,
		message: PROGRESS_MESSAGES[ProgressType.Saving],
	});
	recipeLogger?.onSaving?.();
	const pageId = await createRecipePage({
		recipe,
		tags,
		...notionConfig,
		skipDuplicateCheck: true,
	});

	const notionUrl = getNotionPageUrl(pageId);
	recipeLogger?.onSaved?.(notionUrl);

	recipeLogger?.onSummary?.(recipe, tags);

	return { recipe, tags, pageId };
}

/**
 * Checks for a duplicate recipe and throws an error if found.
 *
 * @param duplicate - Duplicate recipe information, or null if no duplicate.
 * @param logger - Optional logger for duplicate detection events.
 * @throws DuplicateRecipeError if a duplicate is found.
 */
function checkAndThrowIfDuplicate(
	duplicate: { title: string; url: string; notionUrl: string } | null,
	logger?: RecipeLogger,
): asserts duplicate is null {
	if (duplicate) {
		logger?.onDuplicateFound?.(duplicate.title, duplicate.notionUrl);
		throw new DuplicateRecipeError(duplicate.title, duplicate.url, duplicate.notionUrl);
	}
}
