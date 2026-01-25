import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";
import { HealthinessScore } from "./tagger.js";

/**
 * Fallback logger interface matching consola's API.
 */
type FallbackLogger = {
	ready(msg: string): void;
	start(msg: string): void;
	success(msg: string): void;
	warn(msg: string): void;
	error(msg: string): void;
	info(msg: string): void;
	box(options: { title: string; message: string }): void;
};

/**
 * Fallback logger when consola is not available (e.g., in serverless environments).
 */
const fallbackLogger: FallbackLogger = {
	ready: (msg: string) => console.log(`✓ ${msg}`),
	start: (msg: string) => console.log(`→ ${msg}`),
	success: (msg: string) => console.log(`✓ ${msg}`),
	warn: (msg: string) => console.warn(`⚠ ${msg}`),
	error: (msg: string) => console.error(`✗ ${msg}`),
	info: (msg: string) => console.info(`ℹ ${msg}`),
	box: ({ title, message }: { title: string; message: string }) => {
		console.log(`\n${title}`);
		console.log(message);
		console.log();
	},
};

const fallbackColors = {
	underline: (str: string) => str,
	blue: (str: string) => str,
};

/**
 * Gets the consola logger, falling back to console if not available.
 * In serverless environments, consola may not be bundled, so we always use the fallback.
 * For local/CLI usage, consola will be available via static imports in other files.
 *
 * @returns Logger instance (fallback in serverless, consola in CLI).
 */
function getConsola(): FallbackLogger {
	return fallbackLogger;
}

/**
 * Color utility functions interface.
 */
type ColorUtils = {
	underline(str: string): string;
	blue(str: string): string;
};

/**
 * Gets color utilities, falling back to no-op functions if not available.
 *
 * @returns Color utility functions.
 */
function getColors(): ColorUtils {
	return fallbackColors;
}

/**
 * Logger type for recipe processing steps.
 * Allows different implementations (CLI, server, etc.) to handle logging consistently.
 */
export type RecipeLogger = {
	/**
	 * Called when processing starts.
	 */
	onStart?(): void;
	/**
	 * Called when checking for duplicates.
	 */
	onCheckingDuplicates?(): void;
	/**
	 * Called when no duplicate URL is found.
	 */
	onNoDuplicateFound?(): void;
	/**
	 * Called when a duplicate is found.
	 */
	onDuplicateFound?(title: string, notionUrl: string): void;
	/**
	 * Called when scraping starts.
	 */
	onScraping?(): void;
	/**
	 * Called when scraping completes successfully.
	 */
	onScraped?(recipe: Recipe): void;
	/**
	 * Called when AI tagging starts.
	 */
	onTagging?(): void;
	/**
	 * Called when AI tagging completes.
	 */
	onTagged?(): void;
	/**
	 * Called when saving to Notion starts.
	 */
	onSaving?(): void;
	/**
	 * Called when saving to Notion completes.
	 */
	onSaved?(notionUrl: string): void;
	/**
	 * Called when an error occurs.
	 */
	onError?(message: string): void;
};

/**
 * Displays a formatted summary of the scraped and tagged recipe.
 * Shared between CLI and server for consistent output.
 */
export function printRecipeSummary(recipe: Recipe, tags: RecipeTags): void {
	const message = [
		recipe.author ? `Author:      ${recipe.author}` : null,
		`Tags:        ${tags.tags.join(", ")}`,
		`Meal type:   ${tags.mealType.join(", ")}`,
		`Healthiness: ${tags.healthiness}/${HealthinessScore.Max}`,
		`Minutes:     ${tags.totalTimeMinutes}`,
		`Ingredients: ${recipe.ingredients.length} items`,
		`Steps:       ${recipe.instructions.length} steps`,
	]
		.filter((line) => line !== null)
		.join("\n");

	const consola = getConsola();
	consola.box({ title: recipe.name, message });
}

/**
 * Creates a CLI-style logger that uses consola for all output.
 * Falls back to console if consola is not available.
 */
export function createCliLogger(): RecipeLogger {
	const consola = getConsola();
	const colors = getColors();

	return {
		onStart() {
			consola.ready("Processing recipe");
		},
		onCheckingDuplicates() {
			consola.start("Checking for duplicates...");
		},
		onNoDuplicateFound() {
			consola.success("No duplicate URL found");
		},
		onDuplicateFound(title, notionUrl) {
			consola.warn(`Duplicate: "${title}" already exists at ${notionUrl}`);
		},
		onScraping() {
			consola.start("Scraping recipe...");
		},
		onScraped(recipe) {
			const methodLabel = recipe.scrapeMethod === "json-ld" ? "(JSON-LD)" : "(HTML fallback)";
			consola.success(`Scraped: ${recipe.name} ${methodLabel}`);
		},
		onTagging() {
			consola.start("Generating AI scores and tags...");
		},
		onTagged() {
			consola.success("Tagged recipe");
		},
		onSaving() {
			consola.start("Saving to Notion...");
		},
		onSaved(notionUrl) {
			consola.success(`Saved to Notion: ${colors.underline(colors.blue(notionUrl))}`);
		},
		onError(message) {
			consola.error(`Failed: ${message}`);
		},
	};
}
