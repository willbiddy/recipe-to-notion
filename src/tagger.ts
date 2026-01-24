import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { Recipe } from "./scraper.js";

/**
 * AI-generated metadata for a recipe, produced by Claude.
 */
export interface RecipeTags {
  /**
   * Descriptive tags (2-4 items) for cuisine, dish type, and primary protein
   * (e.g. "Italian", "Pasta", "Chicken", "Stir-Fry").
   */
  tags: string[];
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
 * Loaded from system-prompt.md file for easier editing.
 */
const SYSTEM_PROMPT = (() => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = join(__filename, "..");
  const promptPath = join(__dirname, "system-prompt.md");
  try {
    return readFileSync(promptPath, "utf-8").trim();
  } catch (error) {
    throw new Error(
      `Failed to load system prompt from ${promptPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
})();

/**
 * Labels used when formatting recipe data into a user prompt for Claude.
 */
enum PromptLabels {
  RECIPE = "Recipe",
  INGREDIENTS = "Ingredients",
  INSTRUCTIONS = "Instructions",
  TOTAL_TIME = "Total time",
}

/**
 * Claude model configuration for recipe analysis.
 */
enum ClaudeModel {
  MODEL = "claude-sonnet-4-5-20250929",
}

const CLAUDE_CONFIG = {
  MODEL: ClaudeModel.MODEL,
  MAX_TOKENS: 256,
} as const;

/**
 * Sends recipe data to Claude and receives tags, meal-type classifications,
 * healthiness scores, and time estimates.
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


  let parsed;
  try {
    const cleanedText = stripMarkdownCodeBlocks(text);
    parsed = JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(
      `Failed to parse Claude response as JSON. Response: ${text.substring(0, 200)}...`
    );
  }

  const scrapedTime = recipe.totalTimeMinutes;
  const aiEstimatedTime = Number(parsed.totalTimeMinutes) || null;
  
  // Use scraped time if available, otherwise use AI estimate, with a reasonable fallback
  const finalTime = scrapedTime ?? aiEstimatedTime ?? 45;
  
  return {
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    mealType: Array.isArray(parsed.mealType) ? parsed.mealType : [],
    healthiness: clamp(Number(parsed.healthiness) || 5, 0, 10),
    totalTimeMinutes: clamp(finalTime, 15, 180),
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
    `${PromptLabels.RECIPE}: ${recipe.name}`,
    "",
    `${PromptLabels.INGREDIENTS}:`,
    ...recipe.ingredients.map((i) => `- ${i}`),
    "",
    `${PromptLabels.INSTRUCTIONS}:`,
    ...recipe.instructions.map((s, i) => `${i + 1}. ${s}`),
  ];

  if (recipe.totalTimeMinutes) {
    lines.push("", `${PromptLabels.TOTAL_TIME}: ${recipe.totalTimeMinutes} minutes`);
  } else {
    lines.push("", `${PromptLabels.TOTAL_TIME}: not provided (please estimate)`);
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
