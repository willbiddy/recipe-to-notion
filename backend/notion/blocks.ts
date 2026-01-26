import { MAX_NOTION_BLOCKS, MAX_TEXT_LENGTH } from "../../shared/constants.js";
import type { Recipe } from "../scraper.js";
import type { CategorizedIngredient, RecipeTags } from "../tagger.js";
import { IngredientCategory } from "../tagger.js";
import { normalizeDescriptionText, truncate } from "./utils.js";

/**
 * Returns the standard grocery store category order.
 * Produce → Bakery → Meat & seafood → Pantry → Dairy & eggs → Frozen → Other
 *
 * Categories not in this list will appear after Frozen in alphabetical order.
 */
const CATEGORY_ORDER: IngredientCategory[] = [
	IngredientCategory.Produce,
	IngredientCategory.Bakery,
	IngredientCategory.MeatSeafood,
	IngredientCategory.Pantry,
	IngredientCategory.DairyEggs,
	IngredientCategory.Frozen,
	IngredientCategory.Other,
];

/**
 * Groups ingredients by their shopping category.
 *
 * @param ingredients - Array of categorized ingredients.
 * @returns Map of category name to array of ingredients in that category.
 */
function groupIngredientsByCategory(
	ingredients: CategorizedIngredient[],
): Map<IngredientCategory, CategorizedIngredient[]> {
	return ingredients.reduce((map, ingredient) => {
		const category = ingredient.category;
		const group = map.get(category);

		if (group) {
			group.push(ingredient);
		} else {
			map.set(category, [ingredient]);
		}

		return map;
	}, new Map<IngredientCategory, CategorizedIngredient[]>());
}

/**
 * Creates a paragraph block for Notion.
 *
 * @param text - The paragraph text content (truncated to 2000 chars).
 * @returns A Notion paragraph block object.
 */
function paragraph(text: string): unknown {
	return {
		object: "block",
		type: "paragraph",
		paragraph: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Creates a heading_1 block for Notion.
 *
 * @param text - The heading text content.
 * @returns A Notion heading_1 block object.
 */
function heading1(text: string): unknown {
	return {
		object: "block",
		type: "heading_1",
		heading_1: {
			rich_text: [{ type: "text", text: { content: text } }],
		},
	};
}

/**
 * Creates a heading_3 block for Notion (for ingredient categories).
 *
 * @param text - The heading text content.
 * @returns A Notion heading_3 block object.
 */
function heading3(text: string): unknown {
	return {
		object: "block",
		type: "heading_3",
		heading_3: {
			rich_text: [{ type: "text", text: { content: text } }],
		},
	};
}

/**
 * Creates a bulleted_list_item block for Notion.
 *
 * @param text - The list item text content (truncated to 2000 chars).
 * @returns A Notion bulleted_list_item block object.
 */
function bulletItem(text: string): unknown {
	return {
		object: "block",
		type: "bulleted_list_item",
		bulleted_list_item: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Creates a numbered_list_item block for Notion.
 *
 * @param text - The list item text content (truncated to 2000 chars).
 * @returns A Notion numbered_list_item block object.
 */
function numberedItem(text: string): unknown {
	return {
		object: "block",
		type: "numbered_list_item",
		numbered_list_item: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Builds ingredient blocks grouped by category.
 *
 * @param grouped - Map of category names to arrays of ingredients.
 * @returns Array of Notion block objects for ingredients.
 */
function buildIngredientBlocks(
	grouped: Map<IngredientCategory, Array<{ name: string }>>,
): unknown[] {
	const blocks: unknown[] = [];

	const otherCategories = Array.from(grouped.keys())
		.filter((category) => !CATEGORY_ORDER.includes(category))
		.sort();

	const allCategories = [...CATEGORY_ORDER, ...otherCategories];

	for (const category of allCategories) {
		const ingredients = grouped.get(category);

		if (!ingredients || ingredients.length === 0) {
			continue;
		}

		blocks.push(heading3(category));
		blocks.push(...ingredients.map((ingredient) => bulletItem(ingredient.name)));
	}

	return blocks;
}

/**
 * Builds the main body content for a Notion recipe page.
 *
 * Creates blocks in order: description (if available), ingredients (grouped by category if AI-tagged,
 * otherwise as simple list), and instructions. Limits output to MAX_NOTION_BLOCKS to comply with
 * Notion's 100 block per page limit.
 *
 * @param recipe - The recipe data to build the page body from.
 * @param tags - AI-generated tags including description.
 * @returns An array of Notion block objects (limited to MAX_NOTION_BLOCKS).
 */
export function buildPageBody(recipe: Recipe, tags: RecipeTags): unknown[] {
	const blocks: unknown[] = [];

	if (tags.description) {
		const descriptionText = normalizeDescriptionText(tags.description);
		const paragraphs = descriptionText.split("\n\n").filter((paragraph) => paragraph.trim());
		blocks.push(...paragraphs.map((paragraphText) => paragraph(paragraphText)));
	}

	if (tags.ingredients && tags.ingredients.length > 0) {
		blocks.push(heading1("Ingredients"));
		const grouped = groupIngredientsByCategory(tags.ingredients);
		const simplified = new Map<IngredientCategory, Array<{ name: string }>>();
		for (const [category, ingredients] of grouped.entries()) {
			simplified.set(
				category,
				ingredients.map((ing) => ({ name: ing.name })),
			);
		}
		blocks.push(...buildIngredientBlocks(simplified));
	} else if (recipe.ingredients.length > 0) {
		blocks.push(heading1("Ingredients"));
		blocks.push(...recipe.ingredients.map((ingredient) => bulletItem(ingredient)));
	}

	if (recipe.instructions.length > 0) {
		blocks.push(heading1("Preparation"));
		blocks.push(...recipe.instructions.map((step) => numberedItem(step)));
	}

	return blocks.slice(0, MAX_NOTION_BLOCKS);
}
