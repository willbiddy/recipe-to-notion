import * as cheerio from "cheerio";

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
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Recursively searches a JSON-LD structure for an object with `@type: "Recipe"`.
 *
 * Handles various JSON-LD structures including top-level arrays,
 * `@graph` arrays, and direct Recipe objects. Recursively traverses
 * nested structures to find Recipe objects.
 *
 * @param data - The JSON-LD data structure to search.
 * @returns The Recipe object if found, null otherwise.
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
  return {
    name: cleanRecipeName(String(data.name || "Untitled")),
    sourceUrl,
    author: parseAuthor(data.author),
    totalTimeMinutes:
      parseDuration(data.totalTime as string | undefined) ??
      parseDuration(data.cookTime as string | undefined),
    servings: parseServings(data.recipeYield),
    imageUrl: parseImage(data.image),
    ingredients: parseStringArray(data.recipeIngredient),
    instructions: parseInstructions(data.recipeInstructions),
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
  if (typeof yield_ === "string") return yield_;
  if (typeof yield_ === "number") return `${yield_} servings`;
  if (Array.isArray(yield_)) return String(yield_[0]);
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
  if (typeof author === "string") return author;
  if (Array.isArray(author)) {
    const first = author[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "name" in first) return String(first.name);
  }
  if (typeof author === "object" && author !== null && "name" in author) {
    return String((author as { name: string }).name);
  }
  return null;
}

/**
 * Extracts an image URL from the various JSON-LD `image` formats.
 *
 * Handles multiple image formats: direct string URLs, arrays of
 * strings, arrays of ImageObject objects with `url` properties,
 * and single ImageObject objects.
 *
 * @param image - The image data in various JSON-LD formats.
 * @returns The image URL string, or null if not found.
 */
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

/**
 * Coerces unknown data into a string array (handles single string, array, or null).
 *
 * Normalizes various input formats into a consistent string array.
 * Handles single strings, arrays of strings, and null/undefined values.
 *
 * @param data - The data to convert to a string array.
 * @returns An array of strings, empty if input is null/undefined.
 */
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
 *
 * Handles the various instruction formats found in JSON-LD Recipe objects,
 * extracting text from nested structures and flattening the result.
 *
 * @param data - The instruction data in various formats.
 * @returns An array of instruction step strings.
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
 * Fallback scraper that extracts recipe data from microdata attributes
 * and common CSS class patterns when JSON-LD is unavailable.
 *
 * Attempts to extract recipe information using microdata attributes
 * (itemprop) and common CSS class name patterns. Falls back to
 * Open Graph meta tags for title and image.
 *
 * @param $ - Cheerio instance loaded with the page HTML.
 * @param sourceUrl - Original URL of the recipe page.
 * @returns Parsed recipe data if found, null otherwise.
 */
function parseFallback($: cheerio.CheerioAPI, sourceUrl: string): Recipe | null {
  const rawName =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim();

  if (!rawName) return null;
  
  const name = cleanRecipeName(rawName);

  const author =
    $('[itemprop="author"]').first().text().trim() ||
    $('meta[name="author"]').attr("content") ||
    $('[class*="author"] a').first().text().trim() ||
    $('[class*="author"]').first().text().trim() ||
    null;

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
    author: author || null,
    totalTimeMinutes: null,
    servings: null,
    imageUrl,
    ingredients,
    instructions,
  };
}
