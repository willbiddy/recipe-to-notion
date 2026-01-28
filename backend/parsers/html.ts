import type * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { MAX_SITE_NAME_LENGTH, SchemaOrgRecipeUrl } from "../../shared/constants.js";
import type { ParsedRecipe } from "../scraper.js";
import { ScrapeMethod } from "../scraper.js";
import {
	cleanRecipeName,
	decodeHtmlEntities,
	filterEditorNotes,
	INGREDIENT_HEADER_PATTERN,
	INSTRUCTION_HEADER_PATTERN,
	normalizeIngredient,
	parseDuration,
} from "./shared.js";

/**
 * Extracts author from HTML using various patterns.
 *
 * Used as a fallback when JSON-LD doesn't include author info.
 * Tries structured data patterns first, then common class patterns,
 * and finally uses the site name for personal blogs.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @returns The author name if found, null otherwise.
 */
export function extractAuthorFromHtml($: cheerio.CheerioAPI): string | null {
	const structuredAuthor =
		$('[itemprop="author"]').first().text().trim() ||
		$('[itemprop="author"] [itemprop="name"]').first().text().trim() ||
		$('meta[name="author"]').attr("content") ||
		$('meta[property="article:author"]').attr("content") ||
		$('[rel="author"]').first().text().trim();

	if (structuredAuthor) return structuredAuthor;

	const classAuthor =
		$('[class*="recipe-author"]').first().text().trim() ||
		$('[class*="author-name"]').first().text().trim() ||
		$('[class*="byline"] a').first().text().trim() ||
		$('[class*="byline"]').first().text().trim();

	if (classAuthor) return classAuthor;

	const siteName = $('meta[property="og:site_name"]').attr("content");

	if (siteName && siteName.length < MAX_SITE_NAME_LENGTH) {
		return siteName;
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
export function parseHtml($: cheerio.CheerioAPI, sourceUrl: string): ParsedRecipe | null {
	const container = findRecipeContainer($);

	const name = extractRecipeName($, container);
	if (!name) return null;

	const author = extractRecipeAuthor($, container);

	const imageUrl =
		extractMicrodataProperty({ $, container, itemprop: "image", isImage: true }) ||
		extractAttributeWithFallback(
			$,
			"content",
			'meta[property="og:image"]',
			'meta[name="twitter:image"]',
		) ||
		null;

	const description =
		extractAttributeWithFallback(
			$,
			"content",
			'meta[property="og:description"]',
			'meta[name="description"]',
		) || null;

	const totalTimeMinutes = extractMicrodataTime($, container);
	const servings = extractMicrodataProperty({ $, container, itemprop: "recipeYield" }) || null;
	const cuisine = extractMicrodataProperty({ $, container, itemprop: "recipeCuisine" }) || null;
	const category = extractMicrodataProperty({ $, container, itemprop: "recipeCategory" }) || null;

	const ingredients = extractMicrodataTextArray($, container, "recipeIngredient");

	let finalIngredients =
		ingredients.length > 0
			? ingredients
			: extractTextArray($, '[itemprop="recipeIngredient"]', '[class*="ingredient"]');

	if (finalIngredients.length > 0) {
		finalIngredients = finalIngredients.filter(
			(ing: string) => !INGREDIENT_HEADER_PATTERN.test(ing.trim()),
		);
	}

	const instructions = extractRecipeInstructions($, container);

	if (finalIngredients.length === 0 && instructions.length === 0) return null;

	return {
		name,
		sourceUrl,
		scrapeMethod: ScrapeMethod.HtmlFallback,
		author,
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

/**
 * Extracts recipe name with fallbacks.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or null).
 * @returns The recipe name, or null if not found.
 */
function extractRecipeName(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<Element> | null,
): string | null {
	const rawName =
		extractMicrodataProperty({ $, container, itemprop: "name" }) ||
		extractAttributeWithFallback($, "content", 'meta[property="og:title"]') ||
		extractTextWithFallback($, "h1");

	return rawName ? cleanRecipeName(decodeHtmlEntities(rawName)) : null;
}

/**
 * Extracts recipe author with fallbacks.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or null).
 * @returns The recipe author, or null if not found.
 */
function extractRecipeAuthor(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<Element> | null,
): string | null {
	const author =
		extractMicrodataProperty({ $, container, itemprop: "author" }) ||
		extractTextWithFallback($, '[itemprop="author"] [itemprop="name"]') ||
		extractAttributeWithFallback($, "content", 'meta[name="author"]') ||
		extractTextWithFallback($, '[class*="author"] a', '[class*="author"]') ||
		null;

	return author ? decodeHtmlEntities(author) : null;
}

/**
 * Extracts recipe instructions with fallbacks.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or null).
 * @returns Array of instruction step strings.
 */
function extractRecipeInstructions(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<Element> | null,
): string[] {
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
			instructions = extractMicrodataTextArray($, container, "step");
		}
	}

	if (instructions.length === 0) {
		const instructionContainers = $('[class*="instruction"], [class*="direction"]');
		if (instructionContainers.length > 0) {
			instructionContainers.each((_, container) => {
				$(container)
					.find("p, li")
					.not("h1, h2, h3, h4, h5, h6")
					.each((_, el) => {
						const text = $(el).text().trim();
						if (text && !INSTRUCTION_HEADER_PATTERN.test(text)) {
							instructions.push(decodeHtmlEntities(text));
						}
					});
			});
		}
		if (instructions.length === 0) {
			instructions = extractTextArray($, '[itemprop="recipeInstructions"] li', '[itemprop="step"]');
		}
	}
	return filterEditorNotes(instructions);
}

/**
 * Finds the recipe container element with itemtype matching Schema.org Recipe URLs.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @returns The recipe container element, or null if not found.
 */
function findRecipeContainer($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
	const containers = $(
		`[itemtype="${SchemaOrgRecipeUrl.HTTP}"], [itemtype="${SchemaOrgRecipeUrl.HTTPS}"]`,
	);

	if (containers.length > 0) {
		return $(containers[0]);
	}
	return null;
}

/**
 * Options for extracting a microdata property.
 */
type ExtractMicrodataPropertyOptions = {
	$: cheerio.CheerioAPI;
	container: cheerio.Cheerio<Element> | null;
	itemprop: string;
	isImage?: boolean;
};

/**
 * Extracts text content from a microdata itemprop attribute.
 *
 * Handles both direct text content and nested itemprop="name" patterns.
 * For images, extracts the src or content attribute.
 *
 * @param options - Options for extracting the microdata property.
 * @returns The extracted value, or null if not found.
 */
function extractMicrodataProperty({
	$,
	container,
	itemprop,
	isImage = false,
}: ExtractMicrodataPropertyOptions): string | null {
	const selector = container
		? container.find(`[itemprop="${itemprop}"]`)
		: $(`[itemprop="${itemprop}"]`);

	if (selector.length === 0) return null;

	const first = selector.first();

	if (isImage) {
		return first.attr("src") || first.attr("content") || first.attr("href") || null;
	}

	const nestedName = first.find('[itemprop="name"]').first().text().trim();

	if (nestedName) return nestedName;

	const text = first.text().trim();

	if (text) return text;

	return first.attr("content") || null;
}

/**
 * Extracts all text items with a specific itemprop attribute (for arrays like ingredients).
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param container - The recipe container element (or root if null).
 * @param itemprop - The itemprop attribute value to search for.
 * @returns Array of extracted text values.
 */
function extractMicrodataTextArray(
	$: cheerio.CheerioAPI,
	container: cheerio.Cheerio<Element> | null,
	itemprop: string,
): string[] {
	const selector = container
		? container.find(`[itemprop="${itemprop}"]`)
		: $(`[itemprop="${itemprop}"]`);

	const items: string[] = [];
	selector.each((_, el) => {
		const text = $(el).text().trim();
		if (text) {
			const normalized =
				itemprop === "recipeIngredient"
					? normalizeIngredient(decodeHtmlEntities(text))
					: decodeHtmlEntities(text);
			items.push(normalized);
		}
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
	const isIngredientExtraction = selectors.some(
		(sel) => sel.includes("ingredient") || sel.includes("recipeIngredient"),
	);

	for (const selector of selectors) {
		const items: string[] = [];
		$(selector).each((_, el) => {
			const text = $(el).text().trim();
			if (text) {
				const normalized = isIngredientExtraction
					? normalizeIngredient(decodeHtmlEntities(text))
					: decodeHtmlEntities(text);
				items.push(normalized);
			}
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
	container: cheerio.Cheerio<Element> | null,
): number | null {
	const totalTime = extractMicrodataProperty({ $, container, itemprop: "totalTime" });

	if (totalTime) {
		return parseDuration(totalTime);
	}

	const cookTime = extractMicrodataProperty({ $, container, itemprop: "cookTime" });
	const prepTime = extractMicrodataProperty({ $, container, itemprop: "prepTime" });

	if (cookTime || prepTime) {
		const cookMinutes = cookTime ? parseDuration(cookTime) : 0;
		const prepMinutes = prepTime ? parseDuration(prepTime) : 0;
		const total = (cookMinutes || 0) + (prepMinutes || 0);
		return total > 0 ? total : null;
	}

	return null;
}
