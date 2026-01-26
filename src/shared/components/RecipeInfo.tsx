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
		<div class="bg-gradient-to-br from-success-50 to-emerald-50 border-2 border-success-300 rounded-2xl p-5 space-y-3">
			<div class="flex items-center gap-3 mb-2">
				<svg
					class="w-6 h-6 text-success-600 animate-checkmark flex-shrink-0"
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
				<h3 class="text-lg font-bold text-success-900">{props.data.recipe.name}</h3>
			</div>
			<div class="space-y-2 text-sm text-success-800">
				{infoLines().map((line) => (
					<div innerHTML={line} />
				))}
			</div>
			<div class="pt-3">
				<p class="text-sm text-success-900">
					Recipe saved! Open in Notion:{" "}
					<a
						href={props.data.notionUrl}
						target="_blank"
						class="font-semibold underline hover:text-primary-900 transition-colors"
					>
						{props.data.recipe.name}
					</a>
				</p>
			</div>
		</div>
	);
}
