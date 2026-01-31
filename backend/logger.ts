import { colors } from "@shared/colors";
import { formatTimeMinutes } from "@shared/format-utils";
import type { Recipe } from "./scraper.js";
import type { RecipeTags } from "./tagger.js";
import { HealthScore } from "./tagger.js";

/**
 * Logger type for recipe processing steps.
 */
export type RecipeLogger = {
	onStart?(url: string): void;
	onCheckingDuplicates?(): void;
	onNoDuplicateFound?(): void;
	onDuplicateFound?(title: string, notionUrl: string): void;
	onScraping?(): void;
	onScraped?(recipe: Recipe): void;
	onTagging?(): void;
	onTagged?(): void;
	onSaving?(): void;
	onSaved?(notionUrl: string): void;
	onSummary?(recipe: Recipe, tags: RecipeTags): void;
	onError?(message: string): void;
};

/**
 * Creates a console logger with colors and formatting.
 */
export function createConsoleLogger(): RecipeLogger {
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
		onStart(url: string): void {
			console.log(`Processing recipe from ${colors.cyan(url)}`);
		},
		onCheckingDuplicates(): void {
			console.log("Checking for duplicates...");
		},
		onNoDuplicateFound(): void {
			console.log(colors.green("No duplicates found"));
		},
		onDuplicateFound(title: string, notionUrl: string): void {
			console.log(colors.yellow(`Duplicate: "${title}" already exists`));
			console.log(colors.blue(notionUrl));
		},
		onScraping(): void {
			console.log("Scraping recipe data...");
		},
		onScraped(recipe: Recipe): void {
			console.log(colors.green(`Scraped: ${colors.bold(recipe.name)}`));
		},
		onTagging(): void {
			console.log("Generating AI tags and scores...");
		},
		onTagged(): void {
			console.log(colors.green("Tags generated"));
		},
		onSaving(): void {
			console.log("Saving to Notion database...");
		},
		onSaved(notionUrl: string): void {
			console.log(colors.green(`Saved to Notion: ${colors.blue(notionUrl)}`));
		},
		onSummary(recipe: Recipe, tags: RecipeTags): void {
			formatSummary(recipe, tags);
		},
		onError(message: string): void {
			console.log(colors.red(`Failed: ${message}`));
		},
	};
}
