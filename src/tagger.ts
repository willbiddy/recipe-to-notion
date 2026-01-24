import Anthropic from "@anthropic-ai/sdk";
import type { Recipe } from "./scraper.js";

/** AI-generated metadata for a recipe, produced by Claude. */
export interface RecipeTags {
  /** 1-3 cuisine categories (e.g. "Italian", "Indian", "Mediterranean"). */
  cuisine: string[];
  /** Applicable meal types (e.g. "Dinner", "Snack", "Dessert"). */
  mealType: string[];
  /** Difficulty score from 0 (no-cook) to 10 (professional-level). */
  difficulty: number;
  /** Healthiness score from 0 (junk food) to 10 (balanced whole-food meal). */
  healthiness: number;
}

const SYSTEM_PROMPT = `You are a culinary expert that analyzes recipes and provides structured metadata. Given a recipe's name, ingredients, and instructions, return a JSON object with the following fields:

- cuisine: array of 1-3 cuisine categories (e.g. "Italian", "Indian", "Mexican", "American", "French", "Japanese", "Thai", "Mediterranean", "Fusion")
- mealType: array of applicable meal types from: "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer", "Side Dish"
- difficulty: integer 0-10. 0 = no-cook/simple assembly, 3 = basic cooking, 5 = intermediate home cooking, 7 = advanced techniques, 10 = professional-level
- healthiness: integer 0-10. 0 = deep-fried candy bar, 3 = comfort food, 5 = average home meal, 7 = nutritious balanced meal, 10 = optimally balanced whole-food meal

Respond ONLY with valid JSON, no additional text.`;

/**
 * Sends recipe data to Claude and receives cuisine/meal-type classifications
 * along with difficulty and healthiness scores.
 *
 * @param recipe - The scraped recipe to analyze.
 * @param apiKey - Anthropic API key.
 * @returns AI-generated tags and scores for the recipe.
 * @throws If the Claude API call fails or returns unparseable JSON.
 */
export async function tagRecipe(recipe: Recipe, apiKey: string): Promise<RecipeTags> {
  const client = new Anthropic({ apiKey });

  const userMessage = buildPrompt(recipe);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = JSON.parse(text);

  return {
    cuisine: Array.isArray(parsed.cuisine) ? parsed.cuisine : [],
    mealType: Array.isArray(parsed.mealType) ? parsed.mealType : [],
    difficulty: clamp(Number(parsed.difficulty) || 5, 0, 10),
    healthiness: clamp(Number(parsed.healthiness) || 5, 0, 10),
  };
}

/** Formats recipe data into a structured prompt for Claude. */
function buildPrompt(recipe: Recipe): string {
  const lines = [
    `Recipe: ${recipe.name}`,
    "",
    "Ingredients:",
    ...recipe.ingredients.map((i) => `- ${i}`),
    "",
    "Instructions:",
    ...recipe.instructions.map((s, i) => `${i + 1}. ${s}`),
  ];

  if (recipe.totalTimeMinutes) {
    lines.push("", `Total time: ${recipe.totalTimeMinutes} minutes`);
  }
  if (recipe.servings) {
    lines.push(`Servings: ${recipe.servings}`);
  }

  return lines.join("\n");
}

/** Clamps a number to the range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
