/**
 * RecipeInfo component for displaying recipe information after successful save.
 */

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
		healthiness: number;
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
	const infoLines = () => {
		const lines: string[] = [];
		if (props.data.recipe.author) {
			lines.push(`<strong>Author:</strong> ${props.data.recipe.author}`);
		}
		lines.push(`<strong>Tags:</strong> ${props.data.tags.tags.join(", ")}`);
		lines.push(`<strong>Meal type:</strong> ${props.data.tags.mealType.join(", ")}`);
		lines.push(`<strong>Healthiness:</strong> ${props.data.tags.healthiness}/10`);
		lines.push(`<strong>Minutes:</strong> ${props.data.tags.totalTimeMinutes}`);
		lines.push(`<strong>Ingredients:</strong> ${props.data.recipe.ingredients.length} items`);
		lines.push(`<strong>Steps:</strong> ${props.data.recipe.instructions.length} steps`);
		return lines;
	};

	return (
		<div class="py-3 space-y-2 border-t border-gray-200">
			<div class="flex items-center gap-2">
				<svg
					class="w-4 h-4 text-green-600 animate-checkmark flex-shrink-0"
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
				<h3 class="text-sm font-semibold text-gray-900">{props.data.recipe.name}</h3>
			</div>
			<div class="space-y-1 text-xs text-gray-600">
				{infoLines().map((line) => (
					<div innerHTML={line} />
				))}
			</div>
			<div class="pt-2">
				<p class="text-xs text-gray-700">
					<a
						href={props.data.notionUrl}
						target="_blank"
						class="text-primary-600 hover:text-primary-700 font-medium underline transition-colors"
					>
						Open in Notion →
					</a>
				</p>
			</div>
		</div>
	);
}
