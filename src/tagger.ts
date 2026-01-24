import Anthropic from "@anthropic-ai/sdk";
import type { Recipe } from "./scraper.js";

export interface RecipeTags {
  cuisine: string[];
  mealType: string[];
  difficulty: number;
  healthiness: number;
}

const SYSTEM_PROMPT = `You are a culinary expert that analyzes recipes and provides structured metadata. Given a recipe's name, ingredients, and instructions, return a JSON object with the following fields:

- cuisine: array of 1-3 cuisine categories (e.g. "Italian", "Indian", "Mexican", "American", "French", "Japanese", "Thai", "Mediterranean", "Fusion")
- mealType: array of applicable meal types from: "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer", "Side Dish"
- difficulty: integer 0-10. 0 = no-cook/simple assembly, 3 = basic cooking, 5 = intermediate home cooking, 7 = advanced techniques, 10 = professional-level
- healthiness: integer 0-10. 0 = deep-fried candy bar, 3 = comfort food, 5 = average home meal, 7 = nutritious balanced meal, 10 = optimally balanced whole-food meal

Respond ONLY with valid JSON, no additional text.`;

export async function tagRecipe(recipe: Recipe, apiKey: string): Promise<RecipeTags> {
  const client = new Anthropic({ apiKey });

  const userMessage = `Recipe: ${recipe.name}

Ingredients:
${recipe.ingredients.map((i) => `- ${i}`).join("\n")}

Instructions:
${recipe.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${recipe.totalTimeMinutes ? `Total time: ${recipe.totalTimeMinutes} minutes` : ""}
${recipe.servings ? `Servings: ${recipe.servings}` : ""}`;

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
