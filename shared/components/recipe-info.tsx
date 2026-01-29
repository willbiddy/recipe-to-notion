/**
 * RecipeInfo - Component for displaying recipe metadata after successful save.
 *
 * Shows a summary of the saved recipe including name, author, AI-generated tags,
 * meal type, health score, prep time, ingredient count, and step count.
 * Includes a link to open the recipe in Notion.
 *
 * Used in the extension popup to provide visual confirmation and quick access
 * to the saved recipe page.
 *
 * Features:
 * - Animated checkmark icon
 * - Compact metadata display (author, tags, meal type, etc.)
 * - Pluralization for items/steps
 * - Formatted time display (e.g., "1h 30m")
 * - Direct Notion link
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <RecipeInfo
 *   data={{
 *     pageId: "abc123",
 *     notionUrl: "https://notion.so/...",
 *     recipe: {
 *       name: "Chocolate Chip Cookies",
 *       author: "Sally Baker",
 *       ingredients: ["flour", "sugar", "..."],
 *       instructions: ["Mix ingredients", "Bake", "..."]
 *     },
 *     tags: {
 *       tags: ["dessert", "baking", "cookies"],
 *       mealType: "Dessert",
 *       healthScore: 6,
 *       totalTimeMinutes: 45
 *     }
 *   }}
 * />
 * ```
 */

import { For } from "solid-js";
import { formatTimeMinutes } from "../format-utils";

/**
 * Recipe data structure passed to RecipeInfo.
 */
export type RecipeInfoData = {
	/** Notion page ID. */
	pageId: string;
	/** Full Notion page URL. */
	notionUrl: string;
	/** Recipe details from scraper. */
	recipe: {
		/** Recipe name/title. */
		name: string;
		/** Recipe author. */
		author: string;
		/** List of ingredient lines. */
		ingredients: string[];
		/** List of instruction steps. */
		instructions: string[];
	};
	/** AI-generated metadata and tags. */
	tags: {
		/** Array of relevant tags (e.g., ["dessert", "baking"]). */
		tags: string[];
		/** Meal type (e.g., "Main", "Dessert"). */
		mealType: string;
		/** Health score from 0-10 (higher is healthier). */
		healthScore: number;
		/** Total recipe time in minutes (prep + cook). */
		totalTimeMinutes: number;
	};
};

/**
 * Props for RecipeInfo component.
 */
export type RecipeInfoProps = {
	/**
	 * Recipe data including metadata, tags, and Notion URL.
	 */
	data: RecipeInfoData;
};

/**
 * RecipeInfo component displays recipe details after successful save.
 *
 * Formats and displays all recipe metadata in a compact, scannable format.
 *
 * @param props - Component props.
 * @param props.data - Recipe data including metadata and tags.
 */
export function RecipeInfo(props: RecipeInfoProps) {
	const { recipe, tags } = props.data;

	const stepCount = recipe.instructions.length;
	const ingredientCount = recipe.ingredients.length;
	const infoItems: { label: string; value: string | null }[] = [
		{ label: "Author", value: recipe.author },
		{ label: "Tags", value: tags.tags.join(", ") },
		{ label: "Meal type", value: tags.mealType },
		{ label: "Health score", value: `${tags.healthScore}/10` },
		{ label: "Time", value: formatTimeMinutes(tags.totalTimeMinutes) },
		{
			label: "Ingredients",
			value: `${ingredientCount} ${ingredientCount === 1 ? "item" : "items"}`,
		},
		{ label: "Steps", value: `${stepCount} ${stepCount === 1 ? "step" : "steps"}` },
	];

	return (
		<div class="py-3 space-y-2 border-t border-gray-200 dark:border-gray-700">
			<div class="flex items-center gap-2">
				<svg
					class="w-4 h-4 text-green-600 dark:text-green-400 animate-checkmark flex-shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{recipe.name}</h3>
			</div>
			<div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
				<For each={infoItems}>
					{(item) => (
						<div>
							<strong>{item.label}:</strong> {item.value}
						</div>
					)}
				</For>
			</div>
			<div class="pt-2">
				<p class="text-xs text-gray-700 dark:text-gray-300">
					<a
						href={props.data.notionUrl}
						target="_blank"
						class="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium underline transition-colors"
					>
						Open in Notion →
					</a>
				</p>
			</div>
		</div>
	);
}
