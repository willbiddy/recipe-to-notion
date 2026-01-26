import type { Client } from "@notionhq/client";
import { DuplicateRecipeError } from "../errors.js";
import { buildPageBody } from "./blocks.js";
import { createNotionClient } from "./client.js";
import { checkForDuplicateByTitle, checkForDuplicateByUrl } from "./duplicates.js";
import { buildPageParams, buildPageProperties } from "./properties.js";
import type { CreateRecipePageOptions } from "./types.js";

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
		const urlDuplicate = await checkForDuplicateByUrl({
			url: recipe.sourceUrl,
			notionApiKey,
			databaseId,
		});

		if (urlDuplicate) {
			throw new DuplicateRecipeError(urlDuplicate.title, urlDuplicate.url, urlDuplicate.notionUrl);
		}

		const titleDuplicate = await checkForDuplicateByTitle({
			recipeName: recipe.name,
			notionApiKey,
			databaseId,
		});

		if (titleDuplicate) {
			throw new DuplicateRecipeError(
				titleDuplicate.title,
				titleDuplicate.url,
				titleDuplicate.notionUrl,
			);
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

	const page = await notion.pages.create(pageParams as Parameters<Client["pages"]["create"]>[0]);
	return page.id;
}
