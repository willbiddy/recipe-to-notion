import type { Client } from "@notionhq/client";
import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import { hasProperty, isArray, isObject } from "@shared/type-guards.js";
import { createNotionClient, getNotionPageUrl } from "./client.js";
import type {
	CheckDuplicateByTitleOptions,
	CheckDuplicateByUrlOptions,
	DuplicateInfo,
} from "./types.js";
import { PropertyNames } from "./types.js";

/**
 * Options for querying pages in a database.
 */
type QueryPagesOptions = {
	notion: Client;
	databaseId: string;
	filter: NonNullable<QueryDataSourceParameters["filter"]>;
	resultBuilder: (properties: Record<string, unknown>, pageId: string) => DuplicateInfo;
};

/**
 * Queries for pages in a Notion database matching a filter condition.
 *
 * Uses the dataSources.query API (2025-09-03) to find pages by property values.
 * First retrieves the database to get its default data source ID.
 *
 * @param options - Query options including Notion client, database ID, filter, and result builder.
 * @returns Information about the matching page if found, null otherwise.
 */
async function queryPagesInDatabase(options: QueryPagesOptions): Promise<DuplicateInfo | null> {
	const { notion, databaseId, filter, resultBuilder } = options;

	// Get the database to retrieve its default data source ID
	const database = await notion.databases.retrieve({ database_id: databaseId });

	// Extract the default data source ID from the database
	if (!("data_sources" in database) || !Array.isArray(database.data_sources)) {
		throw new Error("Database does not have data sources");
	}

	if (database.data_sources.length === 0) {
		throw new Error("Database has no data sources");
	}

	// Use the first (default) data source
	const dataSource = database.data_sources[0];
	if (!dataSource?.id) {
		throw new Error("Data source does not have an ID");
	}

	// Query using the new dataSources.query API
	const response = await notion.dataSources.query({
		data_source_id: dataSource.id,
		filter,
		page_size: 1, // We only need to know if one exists
	});

	if (response.results.length === 0) {
		return null;
	}

	const page = response.results[0];
	if (!page || page.object !== "page" || !("properties" in page)) {
		return null;
	}

	// Validate that properties is an object (runtime check for Notion API response)
	if (!isObject(page.properties)) {
		console.error("[duplicates] Invalid properties from Notion API:", page.properties);
		return null;
	}

	return resultBuilder(page.properties, page.id);
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
 * If the duplicate check fails (e.g., API error), returns null to allow
 * the recipe processing to continue. Duplicate checks are best-effort and
 * should not block recipe processing.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise or on error.
 */
export async function checkForDuplicateByUrl(
	options: CheckDuplicateByUrlOptions,
): Promise<DuplicateInfo | null> {
	const { url, notionApiKey, databaseId } = options;
	const notion = createNotionClient(notionApiKey);

	try {
		return await queryPagesInDatabase({
			notion,
			databaseId,
			filter: {
				property: PropertyNames.SOURCE,
				url: {
					equals: url,
				},
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
		console.warn(
			`Failed to check for duplicate by URL: ${error instanceof Error ? error.message : String(error)}. Continuing without duplicate check.`,
		);
		return null;
	}
}

/**
 * Checks if a recipe with the same title already exists in the database.
 *
 * Use this after already checking for URL duplicates to avoid redundant API calls.
 * Queries for recipes with the same title using the Notion SDK.
 *
 * If the duplicate check fails (e.g., API error), returns null to allow
 * the recipe processing to continue. Duplicate checks are best-effort and
 * should not block recipe processing.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise or on error.
 */
export async function checkForDuplicateByTitle(
	options: CheckDuplicateByTitleOptions,
): Promise<DuplicateInfo | null> {
	const { recipeName, notionApiKey, databaseId } = options;
	const notion = createNotionClient(notionApiKey);

	try {
		return await queryPagesInDatabase({
			notion,
			databaseId,
			filter: {
				property: PropertyNames.NAME,
				title: {
					equals: recipeName,
				},
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
		console.warn(
			`Failed to check for duplicate by title: ${error instanceof Error ? error.message : String(error)}. Continuing without duplicate check.`,
		);
		return null;
	}
}
