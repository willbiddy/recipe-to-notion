import { formatTimeMinutes } from "../shared/format-utils.js";
import type { Recipe } from "./scraper.js";
import { ScrapeMethod } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";
import { HealthScore } from "./tagger.js";

/**
 * Logger type for recipe processing steps.
 * Allows different implementations (CLI, server, etc.) to handle logging consistently.
 */
export type RecipeLogger = {
	/**
	 * Called when processing starts.
	 * @param url - The recipe URL being processed.
	 */
	onStart?(url: string): void;
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
	 * Called to display the recipe summary after processing completes.
	 */
	onSummary?(recipe: Recipe, tags: RecipeTags): void;
	/**
	 * Called when an error occurs.
	 */
	onError?(message: string): void;
};

/**
 * Creates a console logger using native console methods.
 * Suitable for both CLI and serverless contexts where console output is desired.
 */
export function createConsoleLogger(): RecipeLogger {
	/**
	 * Formats and displays a recipe summary with tags and metadata.
	 *
	 * Creates a formatted display showing recipe name, author,
	 * tags, meal type, health score, time, ingredient count, and step count.
	 *
	 * @param recipe - The recipe data to display.
	 * @param tags - The AI-generated tags and metadata.
	 */
	const formatSummary = (recipe: Recipe, tags: RecipeTags): void => {
		const INDENT = "  ";

		const lines = [
			`✓ ${recipe.name}`,
			`${INDENT}Author: ${recipe.author}`,
			`${INDENT}Tags: ${tags.tags.join(", ")}`,
			`${INDENT}Meal type: ${tags.mealType.join(", ")}`,
			`${INDENT}Health score: ${tags.healthScore}/${HealthScore.Max}`,
			`${INDENT}Total time: ${formatTimeMinutes(tags.totalTimeMinutes)}`,
			`${INDENT}Ingredients: ${recipe.ingredients.length} items`,
			`${INDENT}Steps: ${recipe.instructions.length} steps`,
		];

		console.log("");
		console.log(lines.join("\n"));
	};

	return {
		onStart(url: string) {
			console.log(`→ Processing recipe: ${url}`);
		},
		onCheckingDuplicates() {
			console.log("  Checking for duplicates...");
		},
		onNoDuplicateFound() {
			console.log("  ✓ No duplicates");
		},
		onDuplicateFound(title: string, notionUrl: string) {
			console.warn(`  ⚠ Duplicate: "${title}" already exists at ${notionUrl}`);
		},
		onScraping() {
			console.log("  Scraping recipe...");
		},
		onScraped(recipe: Recipe) {
			const methodLabel =
				recipe.scrapeMethod === ScrapeMethod.JsonLd ? "(JSON-LD)" : "(HTML fallback)";
			console.log(`  ✓ Scraped ${methodLabel}: ${recipe.name}`);
		},
		onTagging() {
			console.log("  Generating tags...");
		},
		onTagged() {
			console.log("  ✓ Tags generated");
		},
		onSaving() {
			console.log("  Saving to Notion...");
		},
		onSaved(notionUrl: string) {
			console.log(`  ✓ Saved to Notion: ${notionUrl}`);
		},
		onSummary(recipe: Recipe, tags: RecipeTags) {
			formatSummary(recipe, tags);
		},
		onError(message: string) {
			console.error(`  ✗ Failed: ${message}`);
		},
	};
}
