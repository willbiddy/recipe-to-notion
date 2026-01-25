import type * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { Recipe } from "../scraper.js";
import {
	cleanRecipeName,
	decodeHtmlEntities,
	filterEditorNotes,
	normalizeIngredientParentheses,
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
	/**
	 * Try structured data patterns first.
	 */
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

	/**
	 * For personal blogs, use the site name as author (last resort).
	 */
	const siteName = $('meta[property="og:site_name"]').attr("content");
	if (siteName && siteName.length < 50) return siteName;

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
export function parseHtml($: cheerio.CheerioAPI, sourceUrl: string): Recipe | null {
	/**
	 * Find recipe container with itemtype="http://schema.org/Recipe" or "https://schema.org/Recipe".
	 */
	const container = findRecipeContainer($);

	/**
	 * Extract name from microdata first, then fall back to og:title/h1.
	 */
	const name = extractRecipeName($, container);
	if (!name) return null;

	/**
	 * Extract author from microdata, then fall back to other patterns.
	 */
	const author = extractRecipeAuthor($, container);

	/**
	 * Extract image from microdata, then fall back to og:image/twitter:image.
	 */
	const imageUrl =
		extractMicrodataProperty($, container, "image", true) ||
		extractAttributeWithFallback(
			$,
			"content",
			'meta[property="og:image"]',
			'meta[name="twitter:image"]',
		) ||
		null;

	/**
	 * Extract description from microdata, then fall back to og:description/meta description.
	 */
	const description =
		extractAttributeWithFallback(
			$,
			"content",
			'meta[property="og:description"]',
			'meta[name="description"]',
		) || null;

	/**
	 * Extract time from microdata.
	 */
	const totalTimeMinutes = extractMicrodataTime($, container);

	/**
	 * Extract servings from microdata.
	 */
	const servings = extractMicrodataProperty($, container, "recipeYield") || null;

	/**
	 * Extract cuisine from microdata.
	 */
	const cuisine = extractMicrodataProperty($, container, "recipeCuisine") || null;

	/**
	 * Extract category from microdata.
	 */
	const category = extractMicrodataProperty($, container, "recipeCategory") || null;

	/**
	 * Extract ingredients from microdata, then fall back to CSS classes.
	 */
	const ingredients = extractMicrodataArray($, container, "recipeIngredient");
	const finalIngredients =
		ingredients.length > 0
			? ingredients
			: extractTextArray($, '[itemprop="recipeIngredient"]', '[class*="ingredient"]');

	/**
	 * Extract instructions from microdata, then fall back to CSS classes.
	 */
	const instructions = extractRecipeInstructions($, container);

	if (finalIngredients.length === 0 && instructions.length === 0) return null;

	return {
		name,
		sourceUrl,
		scrapeMethod: "html-fallback",
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
		extractMicrodataProperty($, container, "name") ||
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
		extractMicrodataProperty($, container, "author") ||
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
	return filterEditorNotes(instructions);
}

/**
 * Finds the recipe container element with itemtype="http://schema.org/Recipe" or "https://schema.org/Recipe".
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @returns The recipe container element, or null if not found.
 */
function findRecipeContainer($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
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
	container: cheerio.Cheerio<Element> | null,
	itemprop: string,
	isImage = false,
): string | null {
	const selector = container
		? container.find(`[itemprop="${itemprop}"]`)
		: $(`[itemprop="${itemprop}"]`);

	if (selector.length === 0) return null;

	const first = selector.first();

	if (isImage) {
		/**
		 * For images, try src, content, or href attributes.
		 */
		return first.attr("src") || first.attr("content") || first.attr("href") || null;
	}

	/**
	 * For text, try nested itemprop="name" first, then direct text.
	 */
	const nestedName = first.find('[itemprop="name"]').first().text().trim();
	if (nestedName) return nestedName;

	const text = first.text().trim();
	if (text) return text;

	/**
	 * Fallback to content attribute for meta tags.
	 */
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
			/**
			 * Normalize parentheses for ingredients.
			 */
			const normalized =
				itemprop === "recipeIngredient"
					? normalizeIngredientParentheses(decodeHtmlEntities(text))
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
/**
 * Extracts array of text values from elements matching CSS selectors.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param selectors - Array of CSS selectors to try in order.
 * @returns Array of non-empty text values.
 */
function extractTextArray($: cheerio.CheerioAPI, ...selectors: string[]): string[] {
	/**
	 * Check if any selector is for ingredients (to normalize parentheses).
	 */
	const isIngredientExtraction = selectors.some(
		(sel) => sel.includes("ingredient") || sel.includes("recipeIngredient"),
	);

	for (const selector of selectors) {
		const items: string[] = [];
		$(selector).each((_, el) => {
			const text = $(el).text().trim();
			if (text) {
				/**
				 * Normalize parentheses for ingredients.
				 */
				const normalized = isIngredientExtraction
					? normalizeIngredientParentheses(decodeHtmlEntities(text))
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
	/**
	 * Try totalTime first, then calculate from cookTime + prepTime.
	 */
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
