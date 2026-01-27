/**
 * RecipeInfo component for displaying recipe information after successful save.
 */

import { For } from "solid-js";
import { formatTimeMinutes } from "../format-utils";

export type RecipeInfoData = {
	pageId: string;
	notionUrl: string;
	recipe: {
		name: string;
		author: string | null;
		ingredients: string[];
		instructions: string[];
	};
	tags: {
		tags: string[];
		mealType: string[];
		healthScore: number;
		totalTimeMinutes: number;
	};
};

export type RecipeInfoProps = {
	data: RecipeInfoData;
};

/**
 * RecipeInfo component displays recipe details after successful save.
 */
export function RecipeInfo(props: RecipeInfoProps) {
	const { recipe, tags } = props.data;

	const infoItems: { label: string; value: string | null }[] = [
		{ label: "Author", value: recipe.author },
		{ label: "Tags", value: tags.tags.join(", ") },
		{ label: "Meal type", value: tags.mealType.join(", ") },
		{ label: "Health score", value: `${tags.healthScore}/10` },
		{ label: "Time", value: formatTimeMinutes(tags.totalTimeMinutes) },
		{ label: "Ingredients", value: `${recipe.ingredients.length} items` },
		{ label: "Steps", value: `${recipe.instructions.length} steps` },
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
