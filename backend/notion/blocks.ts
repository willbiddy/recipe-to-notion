import { MAX_NOTION_BLOCKS, MAX_TEXT_LENGTH } from "@shared/constants.js";
import type { Recipe } from "../scraper.js";
import type { CategorizedIngredient, RecipeTags } from "../tagger.js";
import { IngredientCategory } from "../tagger.js";
import type {
	NotionBlock,
	NotionBulletedListItemBlock,
	NotionColumnBlock,
	NotionColumnListBlock,
	NotionHeading1Block,
	NotionHeading3Block,
	NotionNumberedListItemBlock,
	NotionParagraphBlock,
} from "./types.js";
import { normalizeDescriptionText, truncate } from "./utils.js";

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
function paragraph(text: string): NotionParagraphBlock {
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
function heading1(text: string): NotionHeading1Block {
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
function heading3(text: string): NotionHeading3Block {
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
function bulletItem(text: string): NotionBulletedListItemBlock {
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
function numberedItem(text: string): NotionNumberedListItemBlock {
	return {
		object: "block",
		type: "numbered_list_item",
		numbered_list_item: {
			rich_text: [{ type: "text", text: { content: truncate(text, MAX_TEXT_LENGTH) } }],
		},
	};
}

/**
 * Creates a column block with children.
 *
 * @param children - Array of Notion blocks to include in this column.
 * @returns A Notion column block object.
 */
function column(children: NotionBlock[]): NotionColumnBlock {
	return {
		object: "block",
		type: "column",
		column: {
			children,
		},
	};
}

/**
 * Creates a column_list block containing multiple columns.
 *
 * @param columns - Array of column blocks to include in the column list.
 * @returns A Notion column_list block object.
 */
function columnList(columns: NotionColumnBlock[]): NotionColumnListBlock {
	return {
		object: "block",
		type: "column_list",
		column_list: {
			children: columns,
		},
	};
}

/**
 * Builds ingredient blocks grouped by category.
 *
 * @param grouped - Map of category names to arrays of categorized ingredients.
 * @returns Array of Notion block objects for ingredients.
 */
function buildIngredientBlocks(
	grouped: Map<IngredientCategory, CategorizedIngredient[]>,
): NotionBlock[] {
	const blocks: NotionBlock[] = [];

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
 * Creates a layout with:
 * - Full-width description at the top (no heading)
 * - Two-column layout below:
 *   - Left column: Ingredients section
 *   - Right column: Preparation section
 *
 * Falls back to linear layout if either column would be empty. Limits output to MAX_NOTION_BLOCKS
 * to comply with Notion's 100 block per page limit.
 *
 * @param recipe - The recipe data to build the page body from.
 * @param tags - AI-generated tags including description.
 * @returns An array of Notion block objects (limited to MAX_NOTION_BLOCKS).
 */
export function buildPageBody(recipe: Recipe, tags: RecipeTags): NotionBlock[] {
	const fullWidthBlocks: NotionBlock[] = [];
	const leftColumnBlocks: NotionBlock[] = [];
	const rightColumnBlocks: NotionBlock[] = [];

	// Full-width description at the top (no heading)
	if (tags.description) {
		const descriptionText = normalizeDescriptionText(tags.description);
		const paragraphs = descriptionText.split("\n\n").filter((paragraph) => paragraph.trim());
		fullWidthBlocks.push(...paragraphs.map((paragraphText) => paragraph(paragraphText)));
	}

	// Left column: Ingredients section
	if (tags.ingredients && tags.ingredients.length > 0) {
		leftColumnBlocks.push(heading1("Ingredients"));
		const grouped = groupIngredientsByCategory(tags.ingredients);
		leftColumnBlocks.push(...buildIngredientBlocks(grouped));
	} else if (recipe.ingredients.length > 0) {
		leftColumnBlocks.push(heading1("Ingredients"));
		leftColumnBlocks.push(...recipe.ingredients.map((ingredient) => bulletItem(ingredient)));
	}

	// Right column: Preparation section
	if (recipe.instructions.length > 0) {
		rightColumnBlocks.push(heading1("Preparation"));
		rightColumnBlocks.push(...recipe.instructions.map((step) => numberedItem(step)));
	}

	// Fallback to linear layout if either column is empty
	// (This handles edge cases where ingredients or instructions are missing)
	if (leftColumnBlocks.length === 0 || rightColumnBlocks.length === 0) {
		return [...fullWidthBlocks, ...leftColumnBlocks, ...rightColumnBlocks].slice(
			0,
			MAX_NOTION_BLOCKS,
		);
	}

	// Create two-column layout
	// The column_list contains two columns with equal width (50/50 split by default)
	const leftCol = column(leftColumnBlocks);
	const rightCol = column(rightColumnBlocks);
	const layout = columnList([leftCol, rightCol]);

	return [...fullWidthBlocks, layout];
}
