import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Browser-like HTTP headers to avoid bot detection.
 */
const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	Accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
	"Accept-Encoding": "gzip, deflate, br",
	"Cache-Control": "no-cache",
	Connection: "keep-alive",
	DNT: "1",
	Pragma: "no-cache",
	"Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
	"Sec-Ch-Ua-Mobile": "?0",
	"Sec-Ch-Ua-Platform": '"macOS"',
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "none",
	"Sec-Fetch-User": "?1",
	"Upgrade-Insecure-Requests": "1",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HTML entity decoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decodes HTML entities in a string to their Unicode characters.
 *
 * Uses cheerio's built-in HTML parser to decode all entity types:
 * named entities (e.g., &frac34;), decimal (&#8532;), and hex (&#x2154;).
 *
 * @param str - String potentially containing HTML entities.
 * @returns String with HTML entities decoded.
 */
function decodeHtmlEntities(str: string): string {
	return cheerio.load(str, null, false).text();
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard that returns true if value is a non-null object.
 *
 * @param value - The value to check.
 * @returns True if value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Type guard that returns true if value is an object with the specified property.
 *
 * @param value - The value to check.
 * @param key - The property key to check for.
 * @returns True if value is an object containing the specified key.
 */
function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
	return isObject(value) && key in value;
}

/**
 * Type guard that returns true if value is a string.
 *
 * @param value - The value to check.
 * @returns True if value is a string.
 */
function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Type guard that returns true if value is an array.
 *
 * @param value - The value to check.
 * @returns True if value is an array.
 */
function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Method used to extract recipe data from the page.
 */
export type ScrapeMethod = "json-ld" | "html-fallback";

/**
 * Structured recipe data extracted from a web page.
 */
export interface Recipe {
	/**
	 * Display name of the recipe.
	 */
	name: string;
	/**
	 * Original URL the recipe was scraped from.
	 */
	sourceUrl: string;
	/**
	 * Method used to extract recipe data.
	 */
	scrapeMethod: ScrapeMethod;
	/**
	 * Recipe author or source attribution, if available.
	 */
	author: string | null;
	/**
	 * Total preparation + cooking time in minutes, if available.
	 */
	totalTimeMinutes: number | null;
	/**
	 * Serving size description (e.g. "4 servings"), if available.
	 */
	servings: string | null;
	/**
	 * URL to the recipe's hero/header image for use as a Notion cover.
	 */
	imageUrl: string | null;
	/**
	 * List of ingredient strings (e.g. "2 cups flour").
	 */
	ingredients: string[];
	/**
	 * Ordered list of instruction steps.
	 */
	instructions: string[];
	/**
	 * Source description from the recipe page, if available.
	 * Used to provide AI with additional context for tagging.
	 */
	description: string | null;
	/**
	 * Cuisine type from the source (e.g., "Italian", "Mexican").
	 * Used as a hint for AI tagging, not authoritative.
	 */
	cuisine: string | null;
	/**
	 * Recipe category from the source (e.g., "appetizer", "main course").
	 * Used as a hint for AI tagging, not authoritative.
	 */
	category: string | null;
}

/**
 * Fetches a recipe URL and extracts structured data.
 *
 * Attempts JSON-LD (schema.org/Recipe) parsing first, which works for most
 * recipe sites including paywalled ones like NYT Cooking that embed structured
 * data for SEO. Falls back to scraping microdata attributes and common CSS
 * class patterns if JSON-LD is unavailable.
 *
 * @param url - The recipe page URL to scrape.
 * @returns Parsed recipe data.
 * @throws If the page cannot be fetched or no recipe data is found.
 */
/**
 * Parses recipe data from HTML content.
 *
 * @param html - The HTML content to parse.
 * @param sourceUrl - The original URL of the recipe (for reference).
 * @returns Parsed recipe data.
 * @throws If no recipe data is found.
 */
function parseRecipeFromHtml(html: string, sourceUrl: string): Recipe {
	const $ = cheerio.load(html);
	const recipe = parseJsonLd($, sourceUrl) ?? parseFallback($, sourceUrl);

	if (!recipe) {
		throw new Error(
			`Could not extract recipe data from ${sourceUrl}. The page may be fully paywalled or not contain a recipe.`,
		);
	}

	// If author wasn't found in JSON-LD, try HTML fallback
	if (!recipe.author) {
		recipe.author = extractAuthorFromHtml($);
	}

	return recipe;
}

export async function scrapeRecipe(url: string): Promise<Recipe> {
	const parsedUrl = new URL(url);

	const response = await fetch(url, {
		headers: {
			...BROWSER_HEADERS,
			Referer: `${parsedUrl.protocol}//${parsedUrl.host}/`,
		},
	});

	if (!response.ok) {
		if (response.status === 403) {
			throw new Error(
				`Failed to fetch ${url}: 403 Forbidden. This site blocks automated requests.\n` +
					`  Tip: Save the page source in your browser and use --html:\n` +
					`  bun src/cli.ts --html ~/Downloads/recipe.html "${url}"`,
			);
		}
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const html = await response.text();
	return parseRecipeFromHtml(html, url);
}

/**
 * Parses recipe data from a local HTML file.
 *
 * Use this when a site blocks automated requests. Save the page source
 * from your browser and pass the file path here.
 *
 * @param htmlPath - Path to the saved HTML file.
 * @param sourceUrl - The original URL of the recipe (for reference).
 * @returns Parsed recipe data.
 * @throws If the file cannot be read or no recipe data is found.
 */
export async function scrapeRecipeFromHtml(htmlPath: string, sourceUrl: string): Promise<Recipe> {
	const html = await readFile(htmlPath, "utf-8");
	try {
		return parseRecipeFromHtml(html, sourceUrl);
	} catch (error) {
		if (error instanceof Error && error.message.includes("Could not extract recipe data")) {
			throw new Error(
				`Could not extract recipe data from ${htmlPath}. The file may not contain valid recipe markup.`,
			);
		}
		throw error;
	}
}

/**
 * Searches all `<script type="application/ld+json">` blocks for a Recipe object.
 *
 * Iterates through all JSON-LD script tags in the HTML and attempts
 * to parse them. If a Recipe object is found, extracts and returns
 * the recipe data. Skips malformed JSON-LD blocks.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param sourceUrl - Original URL of the recipe page.
 * @returns Parsed recipe data if found, null otherwise.
 */
function parseJsonLd($: cheerio.CheerioAPI, sourceUrl: string): Recipe | null {
	const scripts = $('script[type="application/ld+json"]');
	for (let i = 0; i < scripts.length; i++) {
		try {
			const content = $(scripts[i]).html();
			if (!content) continue;

			const data = JSON.parse(content);
			const recipeData = findRecipeInLd(data);
			if (recipeData) {
				return extractFromJsonLd(recipeData, sourceUrl);
			}
		} catch {}
	}
	return null;
}

/**
 * Recursively searches a JSON-LD structure for an object with `@type: "Recipe"`.
 *
 * Handles various JSON-LD structures including top-level arrays,
 * `@graph` arrays, direct Recipe objects, and nested patterns like
 * WebPage containing Recipe in `mainEntity` or `mainEntityOfPage`,
 * ItemList containing Recipe objects, and other schema.org variations.
 *
 * @param data - The JSON-LD data structure to search.
 * @param visited - Set of visited objects to prevent infinite loops.
 * @returns The Recipe object if found, null otherwise.
 */
function findRecipeInLd(data: unknown, visited = new WeakSet<object>()): Record<string, unknown> | null {
	if (!isObject(data)) return null;

	if (isArray(data)) {
		for (const item of data) {
			const found = findRecipeInLd(item, visited);
			if (found) return found;
		}
		return null;
	}

	// Prevent infinite loops with circular references
	if (visited.has(data)) return null;
	visited.add(data);

	// Check if this object is a Recipe
	if (data["@type"] === "Recipe" || (isArray(data["@type"]) && data["@type"].includes("Recipe"))) {
		return data;
	}

	// Handle @graph arrays
	if (isArray(data["@graph"])) {
		const found = findRecipeInLd(data["@graph"], visited);
		if (found) return found;
	}

	// Handle WebPage patterns: mainEntity and mainEntityOfPage
	const mainEntity = data.mainEntity ?? data.mainEntityOfPage;
	if (mainEntity) {
		const found = findRecipeInLd(mainEntity, visited);
		if (found) return found;
	}

	// Handle ItemList patterns: itemListElement
	if (isArray(data.itemListElement)) {
		const found = findRecipeInLd(data.itemListElement, visited);
		if (found) return found;
	}

	// Recursively search all object properties (for other nested patterns)
	for (const value of Object.values(data)) {
		// Skip @context and @id as they're metadata, not content
		if (isObject(value)) {
			const found = findRecipeInLd(value, visited);
			if (found) return found;
		}
	}

	return null;
}

/**
 * Maps a JSON-LD Recipe object to our internal {@link Recipe} interface.
 *
 * Extracts and normalizes recipe data from a JSON-LD Recipe object,
 * handling various formats for time, servings, images, ingredients,
 * and instructions.
 *
 * @param data - The JSON-LD Recipe object.
 * @param sourceUrl - Original URL of the recipe page.
 * @returns A normalized Recipe object.
 */
function extractFromJsonLd(data: Record<string, unknown>, sourceUrl: string): Recipe {
	if (!data.name || typeof data.name !== "string") {
		throw new Error(
			`Recipe name is required but was missing or invalid in JSON-LD data from ${sourceUrl}`,
		);
	}

	// Try author first, fall back to publisher name
	const author = parseAuthor(data.author) ?? parseAuthor(data.publisher);

	return {
		name: decodeHtmlEntities(cleanRecipeName(data.name)),
		sourceUrl,
		scrapeMethod: "json-ld",
		author,
		totalTimeMinutes:
			parseDuration(data.totalTime as string | undefined) ??
			parseDuration(data.cookTime as string | undefined),
		servings: parseServings(data.recipeYield),
		imageUrl: parseImage(data.image),
		ingredients: parseStringArray(data.recipeIngredient),
		instructions: parseInstructions(data.recipeInstructions),
		description: isString(data.description) ? decodeHtmlEntities(data.description) : null,
		cuisine: parseFirstString(data.recipeCuisine),
		category: parseFirstString(data.recipeCategory),
	};
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT1H30M") into total minutes.
 *
 * Converts duration strings like "PT1H30M" (1 hour 30 minutes) or
 * "PT45M" (45 minutes) into a total number of minutes.
 *
 * @param iso - ISO 8601 duration string to parse.
 * @returns Total minutes as a number, or null if parsing fails.
 */
function parseDuration(iso: string | undefined): number | null {
	if (!iso || typeof iso !== "string") return null;
	const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
	if (!match) return null;
	const hours = parseInt(match[1] || "0", 10);
	const minutes = parseInt(match[2] || "0", 10);
	return hours * 60 + minutes || null;
}

/**
 * Normalizes `recipeYield` (string, number, or array) into a display string.
 *
 * Handles various formats for recipe yield/servings data from JSON-LD,
 * converting numbers to display strings and extracting the first item
 * from arrays.
 *
 * @param yield_ - The recipe yield data in various formats.
 * @returns A normalized serving string, or null if unavailable.
 */
function parseServings(yield_: unknown): string | null {
	if (!yield_) return null;
	if (isString(yield_)) return yield_;
	if (typeof yield_ === "number") return `${yield_} servings`;
	if (isArray(yield_)) return String(yield_[0]);
	return null;
}

/**
 * Extracts author name from various JSON-LD `author` formats.
 *
 * Handles multiple author formats: direct string names, Person/Organization
 * objects with a `name` property, and arrays of authors (returns first).
 *
 * @param author - The author data in various JSON-LD formats.
 * @returns The author name string, or null if not found.
 */
function parseAuthor(author: unknown): string | null {
	if (!author) return null;
	if (isString(author)) return author;
	if (isArray(author)) {
		const first = author[0];
		if (isString(first)) return first;
		if (hasProperty(first, "name")) return String(first.name);
	}
	if (hasProperty(author, "name")) return String(author.name);
	return null;
}

/**
 * Extracts a URL from a single image item (string or ImageObject).
 *
 * @param item - A string URL or an object with a `url` property.
 * @returns The URL string, or null if not extractable.
 */
function extractImageUrl(item: unknown): string | null {
	if (isString(item)) return item;
	if (hasProperty(item, "url")) return String(item.url);
	return null;
}

/**
 * Extracts the best (largest) image URL from JSON-LD `image` formats.
 *
 * Handles multiple image formats: direct string URLs, arrays of
 * strings, arrays of ImageObject objects with `url` properties,
 * and single ImageObject objects. When multiple images are available,
 * prefers the largest one (last in array, or highest width).
 *
 * @param image - The image data in various JSON-LD formats.
 * @returns The image URL string, or null if not found.
 */
function parseImage(image: unknown): string | null {
	if (!image) return null;
	if (isString(image)) return image;

	if (isArray(image) && image.length > 0) {
		// Check if first item has width info (ImageObject array)
		const firstItem = image[0];
		if (hasProperty(firstItem, "url") && hasProperty(firstItem, "width")) {
			// Find the largest image by width
			let bestUrl = "";
			let bestWidth = -1;
			for (const item of image) {
				if (!hasProperty(item, "url") || !hasProperty(item, "width")) continue;
				const width = typeof item.width === "number" ? item.width : 0;
				if (width > bestWidth) {
					bestUrl = String(item.url);
					bestWidth = width;
				}
			}
			return bestUrl || null;
		}
		// Array of strings/objects - take the last one (usually full-size)
		return extractImageUrl(image[image.length - 1]);
	}

	return extractImageUrl(image);
}

/**
 * Coerces unknown data into a string array (handles single string, array, or null).
 *
 * Normalizes various input formats into a consistent string array.
 * Handles single strings, arrays of strings, and null/undefined values.
 * Decodes HTML entities in all strings.
 *
 * @param data - The data to convert to a string array.
 * @returns An array of strings, empty if input is null/undefined.
 */
function parseStringArray(data: unknown): string[] {
	if (!data) return [];
	if (isArray(data)) return data.map((item) => decodeHtmlEntities(String(item)));
	if (isString(data)) return [decodeHtmlEntities(data)];
	return [];
}

/**
 * Extracts a single string from data that may be a string or array.
 *
 * Used for fields like recipeCuisine and recipeCategory that can be
 * either a single string or an array of strings.
 *
 * @param data - The data to extract a string from.
 * @returns The first string value, or null if unavailable.
 */
function parseFirstString(data: unknown): string | null {
	if (!data) return null;
	if (isString(data)) return data;
	if (isArray(data) && data.length > 0) return String(data[0]);
	return null;
}

/**
 * Parses `recipeInstructions` which may be a plain string, an array of strings,
 * an array of HowToStep objects, or an array of HowToSection objects containing
 * nested itemListElement arrays.
 *
 * Handles the various instruction formats found in JSON-LD Recipe objects,
 * extracting text from nested structures and flattening the result.
 * Decodes HTML entities in all instruction text.
 *
 * @param data - The instruction data in various formats.
 * @returns An array of instruction step strings.
 */
function parseInstructions(data: unknown): string[] {
	if (!data) return [];
	if (isString(data)) return [decodeHtmlEntities(data)];
	if (!isArray(data)) return [];

	return data.flatMap((item) => {
		if (isString(item)) return [decodeHtmlEntities(item)];
		if (isObject(item)) {
			if (item.text) return [decodeHtmlEntities(String(item.text))];
			if (isArray(item.itemListElement)) {
				return item.itemListElement.map((sub) => {
					const step = sub as { text?: string };
					return decodeHtmlEntities(String(step.text || sub));
				});
			}
		}
		return [];
	});
}

/**
 * Cleans up a recipe name by removing trailing "Recipe" suffix.
 *
 * Many recipe sites append "Recipe" to the title (e.g., "Chicken Parmesan Recipe").
 * This removes that suffix for cleaner display.
 *
 * @param name - The raw recipe name.
 * @returns The cleaned recipe name.
 */
function cleanRecipeName(name: string): string {
	return name.replace(/\s+Recipe$/i, "").trim();
}

/**
 * Extracts author from HTML using various patterns.
 * Used as a fallback when JSON-LD doesn't include author info.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @returns The author name if found, null otherwise.
 */
function extractAuthorFromHtml($: cheerio.CheerioAPI): string | null {
	// Try structured data patterns first
	const structuredAuthor =
		$('[itemprop="author"]').first().text().trim() ||
		$('[itemprop="author"] [itemprop="name"]').first().text().trim() ||
		$('meta[name="author"]').attr("content") ||
		$('meta[property="article:author"]').attr("content") ||
		$('[rel="author"]').first().text().trim();

	if (structuredAuthor) return structuredAuthor;

	// Try common class patterns
	const classAuthor =
		$('[class*="recipe-author"]').first().text().trim() ||
		$('[class*="author-name"]').first().text().trim() ||
		$('[class*="byline"] a').first().text().trim() ||
		$('[class*="byline"]').first().text().trim();

	if (classAuthor) return classAuthor;

	// For personal blogs, use the site name as author (last resort)
	const siteName = $('meta[property="og:site_name"]').attr("content");
	if (siteName && siteName.length < 50) return siteName;

	return null;
}

/**
 * Finds the recipe container element with itemtype="http://schema.org/Recipe" or "https://schema.org/Recipe".
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @returns The recipe container element, or null if not found.
 */
function findRecipeContainer($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
	const containers = $(
		'[itemtype="http://schema.org/Recipe"], [itemtype="https://schema.org/Recipe"]',
	);
	if (containers.length > 0) {
		return $(containers[0]);
	}
	return null;
}

/**
 * Extracts text content from a microdata itemprop attribute.
 *
 * Handles both direct text content and nested itemprop="name" patterns.
 * For images, extracts the src or content attribute.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or root if null).
 * @param itemprop - The itemprop attribute value to search for.
 * @param isImage - If true, extracts src/content attributes instead of text.
 * @returns The extracted value, or null if not found.
 */
function extractMicrodataProperty(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<any> | null,
	itemprop: string,
	isImage = false,
): string | null {
	const selector = container
		? container.find(`[itemprop="${itemprop}"]`)
		: $(`[itemprop="${itemprop}"]`);

	if (selector.length === 0) return null;

	const first = selector.first();

	if (isImage) {
		// For images, try src, content, or href attributes
		return first.attr("src") || first.attr("content") || first.attr("href") || null;
	}

	// For text, try nested itemprop="name" first, then direct text
	const nestedName = first.find('[itemprop="name"]').first().text().trim();
	if (nestedName) return nestedName;

	const text = first.text().trim();
	if (text) return text;

	// Fallback to content attribute for meta tags
	return first.attr("content") || null;
}

/**
 * Extracts all items with a specific itemprop attribute (for arrays like ingredients).
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or root if null).
 * @param itemprop - The itemprop attribute value to search for.
 * @returns Array of extracted text values.
 */
function extractMicrodataArray(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<any> | null,
	itemprop: string,
): string[] {
	const selector = container
		? container.find(`[itemprop="${itemprop}"]`)
		: $(`[itemprop="${itemprop}"]`);

	const items: string[] = [];
	selector.each((_, el) => {
		const text = $(el).text().trim();
		if (text) items.push(decodeHtmlEntities(text));
	});
	return items;
}

/**
 * Extracts text from elements matching CSS selectors, with fallback chain.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param selectors - Array of CSS selectors to try in order.
 * @returns First non-empty text found, or null.
 */
function extractTextWithFallback($: cheerio.CheerioAPI, ...selectors: string[]): string | null {
	for (const selector of selectors) {
		const text = $(selector).first().text().trim();
		if (text) return text;
	}
	return null;
}

/**
 * Extracts attribute value from elements matching CSS selectors, with fallback chain.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param attribute - The attribute name to extract.
 * @param selectors - Array of CSS selectors to try in order.
 * @returns First non-empty attribute value found, or null.
 */
function extractAttributeWithFallback(
	$: cheerio.CheerioAPI,
	attribute: string,
	...selectors: string[]
): string | null {
	for (const selector of selectors) {
		const value = $(selector).first().attr(attribute);
		if (value) return value;
	}
	return null;
}

/**
 * Extracts array of text values from elements matching CSS selectors.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param selectors - Array of CSS selectors to try in order.
 * @returns Array of non-empty text values.
 */
function extractTextArray($: cheerio.CheerioAPI, ...selectors: string[]): string[] {
	for (const selector of selectors) {
		const items: string[] = [];
		$(selector).each((_, el) => {
			const text = $(el).text().trim();
			if (text) items.push(decodeHtmlEntities(text));
		});
		if (items.length > 0) return items;
	}
	return [];
}

/**
 * Extracts time duration from microdata and parses it to minutes.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or root if null).
 * @returns Total time in minutes, or null if not found.
 */
function extractMicrodataTime(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<any> | null,
): number | null {
	// Try totalTime first, then calculate from cookTime + prepTime
	const totalTime = extractMicrodataProperty($, container, "totalTime");
	if (totalTime) {
		return parseDuration(totalTime);
	}

	const cookTime = extractMicrodataProperty($, container, "cookTime");
	const prepTime = extractMicrodataProperty($, container, "prepTime");

	if (cookTime || prepTime) {
		const cookMinutes = cookTime ? parseDuration(cookTime) : 0;
		const prepMinutes = prepTime ? parseDuration(prepTime) : 0;
		const total = (cookMinutes || 0) + (prepMinutes || 0);
		return total > 0 ? total : null;
	}

	return null;
}

/**
 * Fallback scraper that extracts recipe data from microdata attributes
 * and common CSS class patterns when JSON-LD is unavailable.
 *
 * Attempts to extract recipe information using microdata attributes
 * (itemprop) scoped to schema.org/Recipe containers, then falls back
 * to common CSS class name patterns and Open Graph meta tags.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param sourceUrl - Original URL of the recipe page.
 * @returns Parsed recipe data if found, null otherwise.
 */
function parseFallback($: cheerio.CheerioAPI, sourceUrl: string): Recipe | null {
	// Find recipe container with itemtype="http://schema.org/Recipe" or "https://schema.org/Recipe"
	const container = findRecipeContainer($);

	// Extract name from microdata first, then fall back to og:title/h1
	const rawName =
		extractMicrodataProperty($, container, "name") ||
		extractAttributeWithFallback($, "content", 'meta[property="og:title"]') ||
		extractTextWithFallback($, "h1");

	if (!rawName) return null;

	const name = cleanRecipeName(decodeHtmlEntities(rawName));

	// Extract author from microdata, then fall back to other patterns
	const author =
		extractMicrodataProperty($, container, "author") ||
		extractTextWithFallback($, '[itemprop="author"] [itemprop="name"]') ||
		extractAttributeWithFallback($, "content", 'meta[name="author"]') ||
		extractTextWithFallback($, '[class*="author"] a', '[class*="author"]') ||
		null;

	// Extract image from microdata, then fall back to og:image/twitter:image
	const imageUrl =
		extractMicrodataProperty($, container, "image", true) ||
		extractAttributeWithFallback($, "content", 'meta[property="og:image"]', 'meta[name="twitter:image"]') ||
		null;

	// Extract description from microdata, then fall back to og:description/meta description
	const description =
		extractMicrodataProperty($, container, "description") ||
		extractAttributeWithFallback($, "content", 'meta[property="og:description"]', 'meta[name="description"]') ||
		null;

	// Extract time from microdata
	const totalTimeMinutes = extractMicrodataTime($, container);

	// Extract servings from microdata
	const servings =
		extractMicrodataProperty($, container, "recipeYield") ||
		null;

	// Extract cuisine from microdata
	const cuisine =
		extractMicrodataProperty($, container, "recipeCuisine") ||
		null;

	// Extract category from microdata
	const category =
		extractMicrodataProperty($, container, "recipeCategory") ||
		null;

	// Extract ingredients from microdata, then fall back to CSS classes
	const ingredients = extractMicrodataArray($, container, "recipeIngredient");
	const finalIngredients =
		ingredients.length > 0
			? ingredients
			: extractTextArray($, '[itemprop="recipeIngredient"]', '[class*="ingredient"]');

	// Extract instructions from microdata, then fall back to CSS classes
	let instructions: string[] = [];
	if (container) {
		const instructionsContainer = container.find('[itemprop="recipeInstructions"]');
		if (instructionsContainer.length > 0) {
			instructionsContainer.find('[itemprop="step"], li').each((_, el) => {
				const text = $(el).text().trim();
				if (text) instructions.push(decodeHtmlEntities(text));
			});
		}
		if (instructions.length === 0) {
			instructions = extractMicrodataArray($, container, "step");
		}
	}
	if (instructions.length === 0) {
		instructions = extractTextArray(
			$,
			'[itemprop="recipeInstructions"] li',
			'[itemprop="step"]',
			'[class*="instruction"]',
			'[class*="direction"]',
		);
	}

	if (finalIngredients.length === 0 && instructions.length === 0) return null;

	return {
		name,
		sourceUrl,
		scrapeMethod: "html-fallback",
		author: author ? decodeHtmlEntities(author) : null,
		totalTimeMinutes,
		servings: servings ? decodeHtmlEntities(servings) : null,
		imageUrl,
		ingredients: finalIngredients,
		instructions,
		description: description ? decodeHtmlEntities(description) : null,
		cuisine: cuisine ? decodeHtmlEntities(cuisine) : null,
		category: category ? decodeHtmlEntities(category) : null,
	};
}
