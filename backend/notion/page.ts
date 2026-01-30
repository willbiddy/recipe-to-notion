import { DuplicateRecipeError } from "../errors.js";
import { buildPageBody } from "./blocks.js";
import { checkForDuplicate, DuplicateCheckType } from "./duplicates.js";
import {
	buildPageParams,
	buildPageProperties,
	type CreateRecipePageOptions,
	createNotionClient,
} from "./notion-client.js";

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
		const urlDuplicate = await checkForDuplicate({
			value: recipe.sourceUrl,
			notionApiKey,
			databaseId,
			type: DuplicateCheckType.Url,
		});

		if (urlDuplicate) {
			throw new DuplicateRecipeError(urlDuplicate.title, urlDuplicate.url, urlDuplicate.notionUrl);
		}

		const titleDuplicate = await checkForDuplicate({
			value: recipe.name,
			notionApiKey,
			databaseId,
			type: DuplicateCheckType.Title,
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

	const page = await notion.pages.create(pageParams);
	return page.id;
}
