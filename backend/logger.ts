import { colors } from "@shared/colors.js";
import { formatTimeMinutes } from "@shared/format-utils.js";
import type { Recipe } from "./scraper.js";
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
 * Creates a fancy console logger with colors and formatting.
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
		const boxWidth = 60;
		const border = "─".repeat(boxWidth);

		console.log("");
		console.log(border);
		console.log(colors.bold(colors.green(recipe.name)));

		// Author
		console.log(`${colors.bold("Author:")} ${recipe.author}`);

		// Tags
		const tagsFormatted = tags.tags.map((tag) => colors.magenta(tag)).join(" · ");
		console.log(`${colors.bold("Tags:")} ${tagsFormatted}`);

		// Meal type
		const mealTypeFormatted = colors.yellow(tags.mealType);
		console.log(`${colors.bold("Meal:")} ${mealTypeFormatted}`);

		// Health score with color based on score
		const healthColor =
			tags.healthScore >= 8 ? colors.green : tags.healthScore >= 6 ? colors.yellow : colors.red;
		console.log(
			`${colors.bold("Health:")} ${healthColor(`${tags.healthScore}/${HealthScore.Max}`)}`,
		);

		// Time
		console.log(`${colors.bold("Time:")} ${formatTimeMinutes(tags.totalTimeMinutes)}`);

		// Ingredients count
		const ingredientCount = recipe.ingredients.length;
		console.log(
			`${colors.bold("Ingredients:")} ${ingredientCount} ${ingredientCount === 1 ? "item" : "items"}`,
		);

		// Steps count
		const stepCount = recipe.instructions.length;
		console.log(`${colors.bold("Steps:")} ${stepCount} ${stepCount === 1 ? "step" : "steps"}`);

		console.log(border);
	};

	return {
		onStart(url: string) {
			console.log(`Processing recipe from ${colors.cyan(url)}`);
		},
		onCheckingDuplicates() {
			console.log("Checking for duplicates...");
		},
		onNoDuplicateFound() {
			console.log(colors.green("No duplicates found"));
		},
		onDuplicateFound(title: string, notionUrl: string) {
			console.log(colors.yellow(`Duplicate: "${title}" already exists`));
			console.log(colors.blue(notionUrl));
		},
		onScraping() {
			console.log("Scraping recipe data...");
		},
		onScraped(recipe: Recipe) {
			console.log(colors.green(`Scraped: ${colors.bold(recipe.name)}`));
		},
		onTagging() {
			console.log("Generating AI tags and scores...");
		},
		onTagged() {
			console.log(colors.green("Tags generated"));
		},
		onSaving() {
			console.log("Saving to Notion database...");
		},
		onSaved(notionUrl: string) {
			console.log(colors.green(`Saved to Notion: ${colors.blue(notionUrl)}`));
		},
		onSummary(recipe: Recipe, tags: RecipeTags) {
			formatSummary(recipe, tags);
		},
		onError(message: string) {
			console.log(colors.red(`Failed: ${message}`));
		},
	};
}
