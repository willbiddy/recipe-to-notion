import * as cheerio from "cheerio";

export interface Recipe {
  name: string;
  sourceUrl: string;
  totalTimeMinutes: number | null;
  servings: string | null;
  imageUrl: string | null;
  ingredients: string[];
  instructions: string[];
}

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

function extractFromJsonLd(data: Record<string, unknown>, sourceUrl: string): Recipe {
  return {
    name: String(data.name || "Untitled Recipe"),
    sourceUrl,
    totalTimeMinutes: parseDuration(data.totalTime as string | undefined)
      ?? parseDuration(data.cookTime as string | undefined),
    servings: parseServings(data.recipeYield),
    imageUrl: parseImage(data.image),
    ingredients: parseStringArray(data.recipeIngredient),
    instructions: parseInstructions(data.recipeInstructions),
  };
}

function parseDuration(iso: string | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return null;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  return hours * 60 + minutes || null;
}

function parseServings(yield_: unknown): string | null {
  if (!yield_) return null;
  if (typeof yield_ === "string") return yield_;
  if (typeof yield_ === "number") return `${yield_} servings`;
  if (Array.isArray(yield_)) return String(yield_[0]);
  return null;
}

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

function parseStringArray(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(String);
  if (typeof data === "string") return [data];
  return [];
}

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
  $('[class*="instruction"], [class*="direction"], [itemprop="recipeInstructions"] li, [itemprop="step"]').each(
    (_, el) => {
      const text = $(el).text().trim();
      if (text) instructions.push(text);
    }
  );

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
