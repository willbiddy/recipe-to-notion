import type { Client } from "@notionhq/client";
import { hasProperty, isArray, isObject } from "../../shared/type-guards.js";
import { createNotionClient, getNotionPageUrl } from "./client.js";
import type {
	CheckDuplicateByTitleOptions,
	CheckDuplicateByUrlOptions,
	DuplicateInfo,
} from "./types.js";
import { PropertyNames } from "./types.js";
import { handleNotionApiError } from "./utils.js";

/**
 * Options for searching pages in a database.
 */
type SearchPagesOptions = {
	notion: Client;
	databaseId: string;
	query: string;
	propertyMatcher: (properties: Record<string, unknown>) => boolean;
	resultBuilder: (properties: Record<string, unknown>, pageId: string) => DuplicateInfo;
};

/**
 * Searches for pages in a Notion database matching a query and property condition.
 *
 * Uses the search API to find pages, then filters by database and property matcher.
 * This works around the API v2025-09-03 deprecation of databases.query.
 *
 * @param options - Search options including Notion client, database ID, query, matcher, and builder.
 * @returns Information about the matching page if found, null otherwise.
 */
async function searchPagesInDatabase(options: SearchPagesOptions): Promise<DuplicateInfo | null> {
	const { notion, databaseId, query, propertyMatcher, resultBuilder } = options;
	const searchResults = await notion.search({
		filter: {
			value: "page",
			property: "object",
		},
		query,
	});

	for (const result of searchResults.results) {
		if (result.object !== "page") continue;

		const page = result as { id: string; parent?: { type?: string; database_id?: string } };
		if (page.parent?.type !== "database_id" || page.parent?.database_id !== databaseId) {
			continue;
		}

		const fullPage = await notion.pages.retrieve({ page_id: page.id });
		if (
			!("properties" in fullPage) ||
			typeof fullPage.properties !== "object" ||
			fullPage.properties === null
		) {
			continue;
		}

		const properties = fullPage.properties as Record<string, unknown>;
		if (propertyMatcher(properties)) {
			return resultBuilder(properties, page.id);
		}
	}

	return null;
}

/**
 * Extracts the title text from a Notion title property.
 *
 * @param property - The Notion title property object.
 * @returns The plain text title, or empty string if not found.
 */
function extractTitle(property: unknown): string {
	if (!property || typeof property !== "object" || property === null) {
		return "";
	}

	if (!hasProperty(property, "title") || !isArray(property.title)) {
		return "";
	}

	if (property.title.length === 0) {
		return "";
	}

	const firstTitle = property.title[0];

	if (!isObject(firstTitle) || !hasProperty(firstTitle, "plain_text")) {
		return "";
	}

	return String(firstTitle.plain_text);
}

/**
 * Extracts the URL from a Notion URL property.
 *
 * @param property - The Notion URL property object.
 * @returns The URL string, or empty string if not found.
 */
function extractUrl(property: unknown): string {
	if (!property || typeof property !== "object" || property === null) {
		return "";
	}

	if (!("url" in property) || property.url === null) {
		return "";
	}

	return String(property.url);
}

/**
 * Checks if a recipe with the same URL already exists in the database.
 *
 * Useful for early duplicate detection before scraping.
 * Queries for recipes with the same URL using the Notion SDK.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise.
 */
export async function checkForDuplicateByUrl(
	options: CheckDuplicateByUrlOptions,
): Promise<DuplicateInfo | null> {
	const { url, notionApiKey, databaseId } = options;
	const notion = createNotionClient(notionApiKey);

	try {
		return await searchPagesInDatabase({
			notion,
			databaseId,
			query: url,
			propertyMatcher: (properties) => {
				if (PropertyNames.SOURCE in properties) {
					const sourceUrl = extractUrl(properties[PropertyNames.SOURCE]);
					return sourceUrl === url;
				}
				return false;
			},
			resultBuilder: (properties, pageId) => {
				const title =
					PropertyNames.NAME in properties
						? extractTitle(properties[PropertyNames.NAME])
						: "Unknown Recipe";
				const sourceUrl = extractUrl(properties[PropertyNames.SOURCE]);
				return {
					title,
					url: sourceUrl,
					pageId,
					notionUrl: getNotionPageUrl(pageId),
				};
			},
		});
	} catch (error) {
		handleNotionApiError(error, PropertyNames.SOURCE, "URL");
	}
}

/**
 * Checks if a recipe with the same title already exists in the database.
 *
 * Use this after already checking for URL duplicates to avoid redundant API calls.
 * Queries for recipes with the same title using the Notion SDK.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise.
 */
export async function checkForDuplicateByTitle(
	options: CheckDuplicateByTitleOptions,
): Promise<DuplicateInfo | null> {
	const { recipeName, notionApiKey, databaseId } = options;
	const notion = createNotionClient(notionApiKey);

	try {
		return await searchPagesInDatabase({
			notion,
			databaseId,
			query: recipeName,
			propertyMatcher: (properties) => {
				if (PropertyNames.NAME in properties) {
					const pageTitle = extractTitle(properties[PropertyNames.NAME]);
					return pageTitle === recipeName;
				}
				return false;
			},
			resultBuilder: (properties, pageId) => {
				const pageTitle = extractTitle(properties[PropertyNames.NAME]);
				const url =
					PropertyNames.SOURCE in properties ? extractUrl(properties[PropertyNames.SOURCE]) : "";
				return {
					title: pageTitle,
					url,
					pageId,
					notionUrl: getNotionPageUrl(pageId),
				};
			},
		});
	} catch (error) {
		handleNotionApiError(error, PropertyNames.NAME, "Title");
	}
}
