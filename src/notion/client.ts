import { Client } from "@notionhq/client";

/**
 * Pattern to match dashes in Notion page IDs (for URL conversion).
 */
const PAGE_ID_DASH_PATTERN = /-/g;

/**
 * Creates a Notion API client instance.
 *
 * @param apiKey - Notion integration API key.
 * @returns Configured Notion client.
 */
export function createNotionClient(apiKey: string): Client {
	return new Client({ auth: apiKey });
}

/**
 * Converts a Notion page ID to a clickable URL.
 *
 * @param pageId - The Notion page ID (with or without dashes).
 * @returns The Notion page URL.
 */
export function getNotionPageUrl(pageId: string): string {
	const cleanId = pageId.replace(PAGE_ID_DASH_PATTERN, "");
	return `https://www.notion.so/${cleanId}`;
}
