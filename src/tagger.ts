import Anthropic from "@anthropic-ai/sdk";
import type { Recipe } from "./scraper.js";

/**
 * AI-generated metadata for a recipe, produced by Claude.
 */
export interface RecipeTags {
  /**
   * 1-3 cuisine categories (e.g. "Italian", "Indian", "Mediterranean").
   */
  cuisine: string[];
  /**
   * Applicable meal types (e.g. "Dinner", "Snack", "Dessert").
   */
  mealType: string[];
  /**
   * Healthiness score from 0 (junk food) to 10 (balanced whole-food meal).
   */
  healthiness: number;
  /**
   * Total preparation + cooking time in minutes. Estimated by AI if not provided.
   */
  totalTimeMinutes: number;
}

/**
 * System prompt for Claude to analyze recipes and generate structured metadata.
 */
const SYSTEM_PROMPT = `You are a culinary expert that analyzes recipes and provides structured metadata. Given a recipe's name, ingredients, and instructions, return a JSON object with the following fields:

- cuisine: array of 1-3 cuisine categories (e.g. "Italian", "Indian", "Mexican", "American", "French", "Japanese", "Thai", "Mediterranean", "Fusion")
- mealType: array of applicable meal types from: "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Appetizer", "Side Dish"
- healthiness: integer 0-10. 0 = deep-fried candy bar, 3 = comfort food, 5 = average home meal, 7 = nutritious balanced meal, 10 = optimally balanced whole-food meal
- totalTimeMinutes: integer (minutes). If a total time is provided in the recipe, use that value. If not provided, estimate the total time based on the number of steps, complexity of techniques, and typical cooking times for similar dishes. Always provide a reasonable estimate.

Respond ONLY with valid JSON, no additional text.`;

/**
 * Labels used when formatting recipe data into a user prompt for Claude.
 */
const PROMPT_LABELS = {
  RECIPE: "Recipe",
  INGREDIENTS: "Ingredients",
  INSTRUCTIONS: "Instructions",
  TOTAL_TIME: "Total time",
} as const;

/**
 * Claude model configuration for recipe analysis.
 */
const CLAUDE_CONFIG = {
  MODEL: "claude-sonnet-4-5-20250929",
  MAX_TOKENS: 256,
} as const;

/**
 * Sends recipe data to Claude and receives cuisine/meal-type classifications
 * along with healthiness scores and time estimates.
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
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: CLAUDE_CONFIG.MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
  const cleanedText = stripMarkdownCodeBlocks(text);

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(
      `Failed to parse Claude response as JSON. Response: ${text.substring(0, 200)}...`
    );
  }

  const scrapedTime = recipe.totalTimeMinutes;
  const aiEstimatedTime = Number(parsed.totalTimeMinutes) || null;
  const finalTime = scrapedTime ?? aiEstimatedTime ?? estimateTimeFromRecipe(recipe);
  
  return {
    cuisine: Array.isArray(parsed.cuisine) ? parsed.cuisine : [],
    mealType: Array.isArray(parsed.mealType) ? parsed.mealType : [],
    healthiness: clamp(Number(parsed.healthiness) || 5, 0, 10),
    totalTimeMinutes: finalTime,
  };
}

/**
 * Formats recipe data into a structured prompt for Claude.
 *
 * Builds a text prompt containing the recipe name, ingredients list,
 * instructions, and optional time information for Claude to analyze.
 *
 * @param recipe - The recipe data to format into a prompt.
 * @returns A formatted string prompt for Claude.
 */
function buildPrompt(recipe: Recipe): string {
  const lines = [
    `${PROMPT_LABELS.RECIPE}: ${recipe.name}`,
    "",
    `${PROMPT_LABELS.INGREDIENTS}:`,
    ...recipe.ingredients.map((i) => `- ${i}`),
    "",
    `${PROMPT_LABELS.INSTRUCTIONS}:`,
    ...recipe.instructions.map((s, i) => `${i + 1}. ${s}`),
  ];

  if (recipe.totalTimeMinutes) {
    lines.push("", `${PROMPT_LABELS.TOTAL_TIME}: ${recipe.totalTimeMinutes} minutes`);
  } else {
    lines.push("", `${PROMPT_LABELS.TOTAL_TIME}: not provided (please estimate)`);
  }

  return lines.join("\n");
}

/**
 * Strips markdown code blocks from text (handles ```json, ```, etc.).
 *
 * This is needed because Claude sometimes wraps JSON responses in
 * markdown code blocks. Removes the code fence markers to extract
 * the raw JSON content.
 *
 * @param text - The text that may contain markdown code blocks.
 * @returns The text with code block markers removed.
 */
function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim();
  
  const codeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(codeBlockRegex);
  
  if (match) {
    cleaned = match[1].trim();
  }
  
  return cleaned;
}

/**
 * Estimates total time in minutes based on recipe complexity.
 *
 * Fallback estimation when neither the scraped recipe nor Claude
 * provides a time estimate. Uses a simple heuristic based on
 * number of ingredients and instructions.
 *
 * @param recipe - The recipe to estimate time for.
 * @returns Estimated time in minutes (minimum 15, maximum 180).
 */
function estimateTimeFromRecipe(recipe: Recipe): number {
  const baseTime = 20;
  const ingredientTime = recipe.ingredients.length * 1.5;
  const instructionTime = recipe.instructions.length * 5;
  const estimated = Math.round(baseTime + ingredientTime + instructionTime);
  return clamp(estimated, 15, 180);
}

/**
 * Clamps a number to the range [min, max].
 *
 * Ensures a numeric value stays within the specified bounds by
 * returning the minimum if value is too low, or the maximum if
 * value is too high.
 *
 * @param value - The number to clamp.
 * @param min - The minimum allowed value.
 * @param max - The maximum allowed value.
 * @returns The clamped value within [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
