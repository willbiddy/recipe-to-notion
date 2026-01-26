import type { Client } from "@notionhq/client";
import { DuplicateRecipeError } from "../errors.js";
import type { Recipe } from "../scraper.js";
import { buildPageBody } from "./blocks.js";
import { createNotionClient } from "./client.js";
import { checkForDuplicateByTitle, checkForDuplicateByUrl } from "./duplicates.js";
import { buildPageParams, buildPageProperties } from "./properties.js";
import type { CreateRecipePageOptions } from "./types.js";

/**
 * Checks if a recipe with the same title or URL already exists in the database.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise.
 */
async function checkForDuplicate({
	recipe,
	notionApiKey,
	databaseId,
	skipUrlCheck = false,
}: {
	recipe: Recipe;
	notionApiKey: string;
	databaseId: string;
	skipUrlCheck?: boolean;
}): Promise<import("./types.js").DuplicateInfo | null> {
	if (!skipUrlCheck) {
		const urlDuplicate = await checkForDuplicateByUrl({
			url: recipe.sourceUrl,
			notionApiKey,
			databaseId,
		});
		if (urlDuplicate) {
			return urlDuplicate;
		}
	}

	return await checkForDuplicateByTitle({
		recipeName: recipe.name,
		notionApiKey,
		databaseId,
	});
}

/**
 * Creates a new page in the Notion recipe database with the recipe's metadata,
 * cover image, and body content (ingredients + instructions).
 *
 * @param options - Options for creating the recipe page.
 * @returns The ID of the newly created Notion page.
 * @throws If a duplicate recipe (same title or URL) already exists and skipDuplicateCheck is false.
 */
export async function createRecipePage({
	recipe,
	tags,
	notionApiKey,
	databaseId,
	skipDuplicateCheck = false,
}: CreateRecipePageOptions): Promise<string> {
	const notion = createNotionClient(notionApiKey);

	if (!skipDuplicateCheck) {
		const duplicate = await checkForDuplicate({
			recipe,
			notionApiKey,
			databaseId,
		});

		if (duplicate) {
			throw new DuplicateRecipeError(duplicate.title, duplicate.url, duplicate.notionUrl);
		}
	}

	const properties = buildPageProperties(recipe, tags);
	const children = buildPageBody(recipe, tags);
	const pageParams = buildPageParams({
		databaseId,
		properties,
		children,
		imageUrl: recipe.imageUrl,
	});

	// Type assertion is safe here because buildPageParams constructs a valid
	// Notion page creation parameters object that matches the SDK's expected type.
	// The Record<string, unknown> return type is necessary because properties
	// are dynamically constructed based on recipe data.
	const page = await notion.pages.create(pageParams as Parameters<Client["pages"]["create"]>[0]);
	return page.id;
}
