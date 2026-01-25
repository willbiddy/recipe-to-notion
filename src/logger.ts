import { consola } from "consola";
import { colors } from "consola/utils";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";

/**
 * Logger interface for recipe processing steps.
 * Allows different implementations (CLI, server, etc.) to handle logging consistently.
 */
export interface RecipeLogger {
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
}

/**
 * Displays a formatted summary of the scraped and tagged recipe.
 * Shared between CLI and server for consistent output.
 */
export function printRecipeSummary(recipe: Recipe, tags: RecipeTags): void {
	const message = [
		recipe.author ? `Author:      ${recipe.author}` : null,
		`Tags:        ${tags.tags.join(", ")}`,
		`Meal type:   ${tags.mealType.join(", ")}`,
		`Healthiness: ${tags.healthiness}/10`,
		`Minutes:     ${tags.totalTimeMinutes}`,
		`Ingredients: ${recipe.ingredients.length} items`,
		`Steps:       ${recipe.instructions.length} steps`,
	]
		.filter((line) => line !== null)
		.join("\n");

	consola.box({
		title: recipe.name,
		message,
	});
}

/**
 * Creates a CLI-style logger that uses consola for all output.
 */
export function createCliLogger(): RecipeLogger {
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
