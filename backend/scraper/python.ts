import { type Recipe, ScrapeMethod } from "@shared/api/types";
import { REQUEST_TIMEOUT_MS } from "@shared/constants";
import { getWebsiteName } from "@shared/url-utils";
import { ParseError, ScrapingError } from "../errors";
import {
	cleanRecipeName,
	filterEditorNotes,
	normalizeFractions,
	normalizeIngredient,
} from "../parsers/shared";

/**
 * Response type from the Python scraper endpoint.
 */
type PythonScraperResponse = {
	title: string;
	author: string | null;
	description: string | null;
	image: string | null;
	ingredients: string[];
	instructions: string[];
	yields: string | null;
	totalTime: number | null;
	canonicalUrl: string | null;
	prepTime: number | null;
	cookTime: number | null;
	cuisine: string | null;
	category: string | null;
	ratings: number | null;
	ratingsCount: number | null;
	equipment: string[] | null;
	nutrients: Record<string, string> | null;
	dietaryRestrictions: string | string[] | null;
	keywords: string | string[] | null;
	cookingMethod: string | null;
	siteName: string | null;
	host: string | null;
	language: string | null;
	error?: string;
	errorType?: string;
};

/**
 * Gets the Python scraper URL based on environment.
 *
 * In production (Vercel), uses the same origin.
 * In development, uses PYTHON_SCRAPER_URL env var or defaults to localhost:5001.
 */
function getPythonScraperUrl(): string {
	// Check for explicit override
	if (process.env.PYTHON_SCRAPER_URL) {
		return process.env.PYTHON_SCRAPER_URL;
	}

	// In Vercel production/preview, use the same origin
	if (process.env.VERCEL_URL) {
		const protocol = process.env.VERCEL_ENV === "development" ? "http" : "https";
		return `${protocol}://${process.env.VERCEL_URL}/api/scrape`;
	}

	// Local development default
	return "http://localhost:5001/scrape";
}

/**
 * Transforms Python scraper response to Recipe type.
 *
 * Applies text normalization (fractions, ingredient cleanup) and
 * author fallback chain to ensure consistent output format.
 */
export function transformPythonResponse(data: PythonScraperResponse, sourceUrl: string): Recipe {
	// Apply author fallback chain: author → siteName → website name → URL
	let author: string | null = data.author;
	if (!author) {
		author = data.siteName;
	}
	if (!author) {
		author = getWebsiteName(sourceUrl) ?? sourceUrl;
	}

	// Normalize ingredients (fractions, double parens, etc.)
	const ingredients: string[] = data.ingredients.map((ing) =>
		normalizeFractions(normalizeIngredient(ing)),
	);

	// Filter editor notes from instructions
	const instructions: string[] = filterEditorNotes(data.instructions);

	// Normalize keywords to array if it's a string
	let keywords: string[] | null = null;
	if (data.keywords) {
		if (typeof data.keywords === "string") {
			keywords = data.keywords
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean);
		} else {
			keywords = data.keywords;
		}
	}

	// Normalize dietary restrictions to array if it's a string
	let dietaryRestrictions: string[] | null = null;
	if (data.dietaryRestrictions) {
		if (typeof data.dietaryRestrictions === "string") {
			dietaryRestrictions = [data.dietaryRestrictions];
		} else {
			dietaryRestrictions = data.dietaryRestrictions;
		}
	}

	return {
		name: cleanRecipeName(data.title),
		sourceUrl: data.canonicalUrl ?? sourceUrl,
		scrapeMethod: ScrapeMethod.PythonScraper,
		author,
		totalTimeMinutes: data.totalTime ?? null,
		servings: data.yields ?? null,
		imageUrl: data.image ?? null,
		ingredients,
		instructions,
		description: data.description ?? null,
		cuisine: data.cuisine ?? null,
		category: data.category ?? null,
		prepTimeMinutes: data.prepTime ?? null,
		cookTimeMinutes: data.cookTime ?? null,
		rating: data.ratings ?? null,
		ratingsCount: data.ratingsCount ?? null,
		equipment: data.equipment ?? null,
		nutrients: data.nutrients ?? null,
		dietaryRestrictions,
		keywords,
		cookingMethod: data.cookingMethod ?? null,
		language: data.language ?? null,
	};
}

/**
 * Parses recipe data from HTML content using Python scraper.
 *
 * Sends HTML to the Python recipe-scrapers endpoint which supports 600+ recipe sites.
 * Falls back gracefully with appropriate error messages.
 *
 * @param html - The HTML content to parse.
 * @param sourceUrl - The original URL of the recipe (for reference).
 * @returns Parsed recipe data.
 * @throws ParseError if no recipe data is found.
 * @throws ScrapingError if Python scraper is unavailable.
 */
export async function parseRecipeFromHtml(html: string, sourceUrl: string): Promise<Recipe> {
	const pythonUrl = getPythonScraperUrl();
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		// Build headers, including Vercel bypass secret if available
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		// Add Vercel deployment protection bypass header if secret is available
		if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
			headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
		}

		const response = await fetch(pythonUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({ url: sourceUrl, html }),
			signal: controller.signal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorData: { error?: string; errorType?: string } = {} as {
				error?: string;
				errorType?: string;
			};
			try {
				errorData = JSON.parse(errorText);
			} catch {
				// Not JSON, use raw text
			}

			if (errorData.errorType === "NoSchemaFoundInWildMode") {
				throw new ParseError(
					`Could not extract recipe data from ${sourceUrl}. The page may not contain a recipe or uses an unsupported format.`,
					sourceUrl,
				);
			}

			throw new ScrapingError({
				message: `Python scraper error: ${errorData.error ?? errorText}`,
				originalUrl: sourceUrl,
				statusCode: response.status,
			});
		}

		const data: PythonScraperResponse = await response.json();

		if (data.error) {
			if (data.errorType === "NoSchemaFoundInWildMode") {
				throw new ParseError(
					`Could not extract recipe data from ${sourceUrl}. The page may not contain a recipe or uses an unsupported format.`,
					sourceUrl,
				);
			}
			throw new ScrapingError({
				message: `Python scraper error: ${data.error}`,
				originalUrl: sourceUrl,
			});
		}

		return transformPythonResponse(data, sourceUrl);
	} catch (error) {
		if (error instanceof ParseError || error instanceof ScrapingError) {
			throw error;
		}

		// Handle timeout
		if (error instanceof Error && error.name === "AbortError") {
			throw new ScrapingError({
				message: `Python scraper timeout: Failed to parse recipe within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
				originalUrl: sourceUrl,
				cause: error,
			});
		}

		// Connection error to Python scraper
		throw new ScrapingError({
			message:
				`Failed to connect to recipe scraper at ${pythonUrl}. ` +
				`Make sure the Python scraper is running (python scripts/scraper-dev.py).`,
			originalUrl: sourceUrl,
			cause: error,
		});
	} finally {
		clearTimeout(timeoutId);
	}
}
