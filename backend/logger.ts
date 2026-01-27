import { consola } from "consola";
import { colors } from "consola/utils";
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
 * Creates a console logger that uses consola for all output.
 * Suitable for both CLI and server contexts where console output is desired.
 */
export function createConsoleLogger(): RecipeLogger {
	/**
	 * Formats and displays a recipe summary with tags and metadata.
	 *
	 * Creates a formatted box display showing recipe name, author (if available),
	 * tags, meal type, health score, time, ingredient count, and step count.
	 *
	 * @param recipe - The recipe data to display.
	 * @param tags - The AI-generated tags and metadata.
	 */
	const formatSummary = (recipe: Recipe, tags: RecipeTags): void => {
		function formatLabel(label: string) {
			return colors.bold(colors.cyan(label));
		}

		const message = [
			recipe.author ? `${formatLabel("Author:")}      ${recipe.author}` : null,
			`${formatLabel("Tags:")}        ${tags.tags.join(", ")}`,
			`${formatLabel("Meal type:")}   ${tags.mealType.join(", ")}`,
			`${formatLabel("Health score:")} ${colors.bold(String(tags.healthScore))}/${HealthScore.Max}`,
			// TODO: format minutes whenever used
			`${formatLabel("Total time:")}     ${colors.bold(String(tags.totalTimeMinutes))}`,
			`${formatLabel("Ingredients:")} ${colors.bold(String(recipe.ingredients.length))} items`,
			`${formatLabel("Steps:")}       ${colors.bold(String(recipe.instructions.length))} steps`,
		]
			.filter((line) => line !== null)
			.join("\n");

		const formattedTitle = colors.bold(colors.green(recipe.name));
		consola.box({ title: formattedTitle, message });
	};

	return {
		onStart(url: string) {
			consola.ready(`Processing recipe: ${colors.underline(colors.blue(url))}`);
		},
		onCheckingDuplicates() {
			consola.start("Checking for duplicates...");
		},
		onNoDuplicateFound() {
			consola.success("No duplicates");
		},
		onDuplicateFound(title: string, notionUrl: string) {
			consola.warn(`Duplicate: "${title}" already exists at ${notionUrl}`);
		},
		onScraping() {
			consola.start("Scraping recipe...");
		},
		onScraped(recipe: Recipe) {
			const methodLabel =
				recipe.scrapeMethod === ScrapeMethod.JsonLd ? "(JSON-LD)" : "(HTML fallback)";
			consola.success(`Scraped ${methodLabel}: ${recipe.name}`);
		},
		onTagging() {
			consola.start("Generating tags...");
		},
		onTagged() {
			consola.success("Tags generated");
		},
		onSaving() {
			consola.start("Saving to Notion...");
		},
		onSaved(notionUrl: string) {
			consola.success(`Saved to Notion: ${colors.underline(colors.blue(notionUrl))}`);
		},
		onSummary(recipe: Recipe, tags: RecipeTags) {
			formatSummary(recipe, tags);
		},
		onError(message: string) {
			consola.error(`Failed: ${message}`);
		},
	};
}
