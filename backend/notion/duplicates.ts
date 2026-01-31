import type { Client } from "@notionhq/client";
import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import { hasProperty, isArray, isObject } from "@shared/type-guards";
import {
	createNotionClient,
	type DuplicateInfo,
	getNotionPageUrl,
	PropertyName,
} from "./notion-client";

/** Type of duplicate check to perform. */
export enum DuplicateCheckType {
	Url = "url",
	Title = "title",
}

/** Options for checking duplicate recipes. */
export type CheckDuplicateOptions = {
	/** Value to check (URL or recipe title). */
	value: string;
	/** Notion integration API key. */
	notionApiKey: string;
	/** Target Notion database ID. */
	databaseId: string;
	/** Type of duplicate check. */
	type: DuplicateCheckType;
};

/** Options for querying pages in a database. */
type QueryPagesOptions = {
	notion: Client;
	databaseId: string;
	filter: NonNullable<QueryDataSourceParameters["filter"]>;
	resultBuilder: (properties: Record<string, unknown>, pageId: string) => DuplicateInfo;
};

/**
 * Queries for pages in a Notion database matching a filter condition.
 *
 * @param options - Query options including Notion client, database ID, filter, and result builder.
 * @returns Information about the matching page if found, null otherwise.
 */
async function queryPagesInDatabase(options: QueryPagesOptions): Promise<DuplicateInfo | null> {
	const { notion, databaseId, filter, resultBuilder } = options;

	const database = await notion.databases.retrieve({ database_id: databaseId });

	if (!("data_sources" in database && Array.isArray(database.data_sources))) {
		throw new Error("Database does not have data sources");
	}

	if (database.data_sources.length === 0) {
		throw new Error("Database has no data sources");
	}

	const dataSource = database.data_sources[0];
	if (!dataSource?.id) {
		throw new Error("Data source does not have an ID");
	}

	const response = await notion.dataSources.query({
		data_source_id: dataSource.id,
		filter,
		page_size: 1,
	});

	if (response.results.length === 0) {
		return null;
	}

	const page = response.results[0];
	if (!page || page.object !== "page" || !("properties" in page)) {
		return null;
	}

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

	if (!(hasProperty(property, "title") && isArray(property.title))) {
		return "";
	}

	if (property.title.length === 0) {
		return "";
	}

	const firstTitle = property.title[0];

	if (!(isObject(firstTitle) && hasProperty(firstTitle, "plain_text"))) {
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
 * Checks if a duplicate recipe exists in the database.
 *
 * @param options - Options for checking duplicates.
 * @returns Information about the duplicate if found, null otherwise or on error.
 */
export async function checkForDuplicate(
	options: CheckDuplicateOptions,
): Promise<DuplicateInfo | null> {
	const { value, notionApiKey, databaseId, type } = options;
	const notion = createNotionClient(notionApiKey);

	type ResultBuilder = (
		properties: Record<string, unknown>,
		pageId: string,
	) => {
		title: string;
		url: string;
		pageId: string;
		notionUrl: string;
	};

	const filter =
		type === DuplicateCheckType.Url
			? {
					property: PropertyName.Source,
					url: { equals: value },
				}
			: {
					property: PropertyName.Name,
					title: { equals: value },
				};

	type ResultBuilderReturn = {
		title: string;
		url: string;
		pageId: string;
		notionUrl: string;
	};

	const resultBuilder: ResultBuilder =
		type === DuplicateCheckType.Url
			? (properties: Record<string, unknown>, pageId: string): ResultBuilderReturn => {
					const title =
						PropertyName.Name in properties
							? extractTitle(properties[PropertyName.Name])
							: "Unknown Recipe";
					const sourceUrl = extractUrl(properties[PropertyName.Source]);
					return {
						title,
						url: sourceUrl,
						pageId,
						notionUrl: getNotionPageUrl(pageId),
					};
				}
			: (properties: Record<string, unknown>, pageId: string): ResultBuilderReturn => {
					const pageTitle = extractTitle(properties[PropertyName.Name]);
					const url =
						PropertyName.Source in properties ? extractUrl(properties[PropertyName.Source]) : "";
					return {
						title: pageTitle,
						url,
						pageId,
						notionUrl: getNotionPageUrl(pageId),
					};
				};

	try {
		return await queryPagesInDatabase({
			notion,
			databaseId,
			filter,
			resultBuilder,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn(
			`Failed to check for duplicate by ${type}: ${errorMessage}. Continuing without duplicate check.`,
		);
		return null;
	}
}
