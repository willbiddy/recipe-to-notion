import type { Recipe } from "../scraper.js";
import type { RecipeTags } from "../tagger.js";
import { PropertyNames } from "./constants.js";
import type { BuildPageParamsOptions } from "./types.js";

/**
 * Builds the page properties for a Notion recipe page.
 *
 * @param recipe - The recipe data.
 * @param tags - AI-generated tags.
 * @returns Record of Notion page properties.
 */
export function buildPageProperties(recipe: Recipe, tags: RecipeTags): Record<string, unknown> {
	const properties: Record<string, unknown> = {
		[PropertyNames.NAME]: {
			title: [{ text: { content: recipe.name } }],
		},
		[PropertyNames.SOURCE]: {
			url: recipe.sourceUrl,
		},
		[PropertyNames.TAGS]: {
			multi_select: tags.tags.map((t) => ({ name: t })),
		},
		[PropertyNames.MEAL_TYPE]: {
			multi_select: tags.mealType.map((m) => ({ name: m })),
		},
		[PropertyNames.HEALTHINESS]: {
			number: tags.healthiness,
		},
		[PropertyNames.MINUTES]: {
			number: tags.totalTimeMinutes,
		},
	};

	if (recipe.author) {
		properties[PropertyNames.AUTHOR] = {
			rich_text: [{ text: { content: recipe.author } }],
		};
	}

	return properties;
}

/**
 * Builds the page parameters for creating a Notion page.
 *
 * @param options - Options for building page parameters.
 * @returns Record of Notion page creation parameters.
 */
export function buildPageParams(options: BuildPageParamsOptions): Record<string, unknown> {
	const { databaseId, properties, children, imageUrl } = options;
	const pageParams: Record<string, unknown> = {
		parent: { database_id: databaseId },
		properties,
		children,
	};

	if (imageUrl) {
		pageParams.cover = {
			type: "external",
			external: { url: imageUrl },
		};
	}

	return pageParams;
}
