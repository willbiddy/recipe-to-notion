import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import {
	CLAUDE_MAX_TOKENS,
	ERROR_PREVIEW_LENGTH_LONG,
	ERROR_PREVIEW_LENGTH_SHORT,
	RECIPE_TIME_MAX_MINUTES,
	RECIPE_TIME_MIN_MINUTES,
} from "@shared/constants";
import { z } from "zod";
import { TaggingError, ValidationError } from "./errors.js";
import type { Recipe } from "./scraper.js";

/** Shopping categories for ingredient organization. */
export enum IngredientCategory {
	Produce = "Produce",
	Bakery = "Bakery",
	MeatSeafood = "Meat & seafood",
	Pantry = "Pantry",
	DairyEggs = "Dairy & eggs",
	Frozen = "Frozen",
	Other = "Other",
}

/** Meal type categories for recipe classification. */
export enum MealType {
	Main = "Main",
	Breakfast = "Breakfast",
	Snack = "Snack",
	Side = "Side",
	Dessert = "Dessert",
	Other = "Other",
}

/** Health score range (1-10). */
export enum HealthScore {
	Min = 1,
	Max = 10,
}

/** Categorized ingredient for shopping organization. */
export type CategorizedIngredient = {
	name: string;
	category: IngredientCategory;
};

/** AI-generated metadata for a recipe. */
export type RecipeTags = {
	tags: string[];
	mealType: MealType;
	healthScore: number;
	totalTimeMinutes: number;
	description: string;
	ingredients: CategorizedIngredient[];
};

enum PromptLabel {
	Recipe = "Recipe",
	Description = "Description",
	Hints = "Hints",
	Ingredients = "Ingredients",
	Instructions = "Instructions",
	Minutes = "Minutes",
}

enum ClaudeModel {
	Haiku = "claude-3-5-haiku-20241022",
	Sonnet = "claude-sonnet-4-5-20250929",
	Opus = "claude-3-opus-20240229",
}

/** Gets the Claude model from environment variable or defaults to Sonnet. */
function getClaudeModel(): ClaudeModel {
	const envModel = process.env.CLAUDE_MODEL?.toLowerCase();

	switch (envModel) {
		case "haiku":
			return ClaudeModel.Haiku;
		case "sonnet":
			return ClaudeModel.Sonnet;
		case "opus":
			return ClaudeModel.Opus;
		default:
			return ClaudeModel.Sonnet;
	}
}

const CLAUDE_MODEL = getClaudeModel();

const categorizedIngredientSchema = z.object({
	name: z.string().min(1, "Ingredient name is required"),
	category: z.enum(IngredientCategory, {
		message: `Category must be one of: ${Object.values(IngredientCategory).join(", ")}`,
	}),
});

const claudeResponseSchema = z.object({
	tags: z.array(z.string()).min(1, "At least one tag is required"),
	mealType: z.enum(MealType, {
		message: `Meal type must be one of: ${Object.values(MealType).join(", ")}`,
	}),
	healthScore: z.number().int().min(HealthScore.Min).max(HealthScore.Max),
	totalTimeMinutes: z.number().int().positive(),
	description: z.string().min(1, "Description is required"),
	ingredients: z.array(categorizedIngredientSchema).min(1, "At least one ingredient is required"),
});

const claudeResponseSchemaWithCrossValidation = claudeResponseSchema.refine(
	(data) => {
		const mealTypeValues = Object.values(MealType);
		const hasConflict = data.tags.some((tag) => mealTypeValues.includes(tag as MealType));
		return !hasConflict;
	},
	{
		message: `Tags array must not contain meal type values (${Object.values(MealType).join(", ")}). Use the mealType field instead.`,
		path: ["tags"],
	},
);

let systemPromptCache: string | null = null;

/** Loads the system prompt from the file system (cached after first load). */
async function loadSystemPrompt(): Promise<string> {
	if (systemPromptCache !== null) {
		return systemPromptCache;
	}

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const promptPath = join(__dirname, "system-prompt.md");

	try {
		const text = await readFile(promptPath, "utf-8");
		systemPromptCache = text.trim();
		return systemPromptCache;
	} catch (error) {
		throw new TaggingError(
			`Failed to load system prompt from ${promptPath}: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
}

/**
 * Sends recipe data to Claude and receives AI-generated tags and metadata.
 *
 * @param recipe - Scraped recipe data
 * @param apiKey - Anthropic API key
 * @returns AI-generated tags and metadata
 * @throws If Claude API call fails or validation fails
 */
export async function tagRecipe(recipe: Recipe, apiKey: string): Promise<RecipeTags> {
	const client = new Anthropic({ apiKey });
	const userMessage = buildPrompt(recipe);
	const systemPrompt = await loadSystemPrompt();

	const response = await callClaudeAPI(client, userMessage, systemPrompt);
	const toolUse = extractToolUse(response);
	const validated = validateClaudeResponse(toolUse);
	const totalTime = recipe.totalTimeMinutes ?? validated.totalTimeMinutes;

	return {
		tags: validated.tags,
		mealType: validated.mealType,
		healthScore: clamp(validated.healthScore, HealthScore.Min, HealthScore.Max),
		totalTimeMinutes: clamp(totalTime, RECIPE_TIME_MIN_MINUTES, RECIPE_TIME_MAX_MINUTES),
		description: validated.description.trim(),
		ingredients: validated.ingredients,
	};
}

async function callClaudeAPI(
	client: Anthropic,
	userMessage: string,
	systemPrompt: string,
): Promise<Anthropic.Messages.Message> {
	try {
		return await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: CLAUDE_MAX_TOKENS,
			system: systemPrompt,
			tools: [
				{
					name: "tag_recipe",
					description: "Output structured recipe tags and metadata",
					input_schema: z.toJSONSchema(claudeResponseSchema) as Anthropic.Tool.InputSchema,
				},
			],
			tool_choice: { type: "tool", name: "tag_recipe" },
			messages: [{ role: "user", content: userMessage }],
		});
	} catch (error) {
		if (error instanceof Anthropic.APIError) {
			throw new TaggingError(
				`Anthropic API error (${error.status}): ${error.message || "Unknown error"}. ` +
					`Details: ${JSON.stringify(error.error || {})}`,
				error,
			);
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		const causeMessage = (() => {
			if (!(error instanceof Error)) return undefined;
			const cause = error.cause;
			if (cause && typeof cause === "object" && "message" in cause) {
				return String(cause.message);
			}
		})();

		throw new TaggingError(
			`Failed to call Anthropic API: ${errorMessage}${causeMessage ? `. Cause: ${causeMessage}` : ""}`,
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

function extractToolUse(response: Anthropic.Messages.Message): Anthropic.Messages.ToolUseBlock {
	const toolUse = response.content.find(
		(block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
	);

	if (!toolUse) {
		const textContent = response.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join("");
		throw new TaggingError(
			`Expected tool_use response from Claude, but received text instead. Response: ${textContent.substring(0, ERROR_PREVIEW_LENGTH_SHORT)}...`,
		);
	}

	return toolUse;
}

function validateClaudeResponse(
	toolUse: Anthropic.Messages.ToolUseBlock,
): z.infer<typeof claudeResponseSchema> {
	const validationResult = claudeResponseSchemaWithCrossValidation.safeParse(toolUse.input);

	if (!validationResult.success) {
		const issues = validationResult.error.issues
			.map((issue) => {
				const path = issue.path.join(".");
				return `  - ${path}: ${issue.message}`;
			})
			.join("\n");
		throw new ValidationError(
			`Claude tool response validation failed:\n${issues}\n\n` +
				`Tool input: ${JSON.stringify(toolUse.input).substring(0, ERROR_PREVIEW_LENGTH_LONG)}...`,
			validationResult.error,
		);
	}

	return validationResult.data;
}

function buildPrompt(recipe: Recipe): string {
	const lines = [`${PromptLabel.Recipe}: ${recipe.name}`];

	if (recipe.description) {
		lines.push("", `${PromptLabel.Description}: ${recipe.description}`);
	}

	const hints = buildHints(recipe);
	if (hints.length > 0) {
		lines.push("", `${PromptLabel.Hints}:`, ...hints.map((h) => `- ${h}`));
	}

	lines.push(
		"",
		`${PromptLabel.Ingredients}:`,
		...recipe.ingredients.map((i) => `- ${i}`),
		"",
		`${PromptLabel.Instructions}:`,
		...recipe.instructions.map((s, i) => `${i + 1}. ${s}`),
	);

	if (recipe.totalTimeMinutes) {
		lines.push("", `${PromptLabel.Minutes}: ${recipe.totalTimeMinutes} minutes`);
	}

	return lines.join("\n");
}

function buildHints(recipe: Recipe): string[] {
	const hints: string[] = [];

	if (recipe.author) hints.push(`Author: ${recipe.author}`);
	if (recipe.cuisine) hints.push(`Cuisine: ${recipe.cuisine}`);
	if (recipe.category) hints.push(`Category: ${recipe.category}`);

	return hints;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
