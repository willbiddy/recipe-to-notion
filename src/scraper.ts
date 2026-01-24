import * as cheerio from "cheerio";

/** Structured recipe data extracted from a web page. */
export interface Recipe {
  /** Display name of the recipe. */
  name: string;
  /** Original URL the recipe was scraped from. */
  sourceUrl: string;
  /** Total preparation + cooking time in minutes, if available. */
  totalTimeMinutes: number | null;
  /** Serving size description (e.g. "4 servings"), if available. */
  servings: string | null;
  /** URL to the recipe's hero/header image for use as a Notion cover. */
  imageUrl: string | null;
  /** List of ingredient strings (e.g. "2 cups flour"). */
  ingredients: string[];
  /** Ordered list of instruction steps. */
  instructions: string[];
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
export async function scrapeRecipe(url: string): Promise<Recipe> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const recipe = parseJsonLd($, url) ?? parseFallback($, url);

  if (!recipe) {
    throw new Error(
      `Could not extract recipe data from ${url}. The page may be fully paywalled or not contain a recipe.`
    );
  }

  return recipe;
}

/**
 * Searches all `<script type="application/ld+json">` blocks for a Recipe object.
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
    } catch {
      // Malformed JSON-LD block — skip and try the next one.
      continue;
    }
  }
  return null;
}

/**
 * Recursively searches a JSON-LD structure for an object with `@type: "Recipe"`.
 * Handles top-level arrays, `@graph` arrays, and direct Recipe objects.
 */
function findRecipeInLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (obj["@type"] === "Recipe" || (Array.isArray(obj["@type"]) && obj["@type"].includes("Recipe"))) {
    return obj;
  }

  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInLd(obj["@graph"]);
  }

  return null;
}

/** Maps a JSON-LD Recipe object to our internal {@link Recipe} interface. */
function extractFromJsonLd(data: Record<string, unknown>, sourceUrl: string): Recipe {
  return {
    name: String(data.name || "Untitled Recipe"),
    sourceUrl,
    totalTimeMinutes:
      parseDuration(data.totalTime as string | undefined) ??
      parseDuration(data.cookTime as string | undefined),
    servings: parseServings(data.recipeYield),
    imageUrl: parseImage(data.image),
    ingredients: parseStringArray(data.recipeIngredient),
    instructions: parseInstructions(data.recipeInstructions),
  };
}

/** Parses an ISO 8601 duration string (e.g. "PT1H30M") into total minutes. */
function parseDuration(iso: string | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return null;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  return hours * 60 + minutes || null;
}

/** Normalizes `recipeYield` (string, number, or array) into a display string. */
function parseServings(yield_: unknown): string | null {
  if (!yield_) return null;
  if (typeof yield_ === "string") return yield_;
  if (typeof yield_ === "number") return `${yield_} servings`;
  if (Array.isArray(yield_)) return String(yield_[0]);
  return null;
}

/** Extracts an image URL from the various JSON-LD `image` formats. */
function parseImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) return String(first.url);
  }
  if (typeof image === "object" && image !== null && "url" in image) {
    return String((image as { url: string }).url);
  }
  return null;
}

/** Coerces unknown data into a string array (handles single string, array, or null). */
function parseStringArray(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(String);
  if (typeof data === "string") return [data];
  return [];
}

/**
 * Parses `recipeInstructions` which may be a plain string, an array of strings,
 * an array of HowToStep objects, or an array of HowToSection objects containing
 * nested itemListElement arrays.
 */
function parseInstructions(data: unknown): string[] {
  if (!data) return [];
  if (typeof data === "string") return [data];
  if (!Array.isArray(data)) return [];

  return data.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (typeof item === "object" && item !== null) {
      if (item.text) return [String(item.text)];
      if (item.itemListElement && Array.isArray(item.itemListElement)) {
        return item.itemListElement.map((sub: { text?: string }) => String(sub.text || sub));
      }
    }
    return [];
  });
}

/**
 * Fallback scraper that extracts recipe data from microdata attributes
 * and common CSS class patterns when JSON-LD is unavailable.
 */
function parseFallback($: cheerio.CheerioAPI, sourceUrl: string): Recipe | null {
  const name =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim();

  if (!name) return null;

  const imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  const ingredients: string[] = [];
  $('[class*="ingredient"], [itemprop="recipeIngredient"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) ingredients.push(text);
  });

  const instructions: string[] = [];
  $(
    '[class*="instruction"], [class*="direction"], [itemprop="recipeInstructions"] li, [itemprop="step"]'
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text) instructions.push(text);
  });

  if (ingredients.length === 0 && instructions.length === 0) return null;

  return {
    name,
    sourceUrl,
    totalTimeMinutes: null,
    servings: null,
    imageUrl,
    ingredients,
    instructions,
  };
}
