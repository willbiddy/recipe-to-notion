import { z } from "zod";
import { ValidationError } from "./errors.js";

/**
 * Environment variable schema for validation.
 * All fields are required and must be non-empty strings with proper format.
 */
const envSchema = z.object({
	ANTHROPIC_API_KEY: z
		.string()
		.min(1, "ANTHROPIC_API_KEY is required")
		.refine((val: string) => val.startsWith("sk-ant-"), {
			message: "ANTHROPIC_API_KEY must start with 'sk-ant-'",
		}),
	NOTION_API_KEY: z
		.string()
		.min(1, "NOTION_API_KEY is required")
		.refine((val: string) => val.startsWith("secret_") || val.startsWith("ntn_"), {
			message: "NOTION_API_KEY must start with 'secret_' or 'ntn_'",
		}),
	NOTION_DATABASE_ID: z.string().min(1, "NOTION_DATABASE_ID is required"),
	API_SECRET: z.string().min(1, "API_SECRET is required"),
	PYTHON_SCRAPER_URL: z.string().url().optional(),
});

/**
 * Validated environment configuration containing all required API keys.
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Loads and validates required environment variables from the process environment.
 *
 * @returns Validated configuration object with API keys and database ID.
 * @throws {ValidationError} If any required environment variable is missing or empty.
 * @example
 * ```ts
 * const config = loadConfig();
 * console.log(config.ANTHROPIC_API_KEY); // Validated API key
 * ```
 */
export function loadConfig(): Config {
	const parseResult = envSchema.safeParse(process.env);

	if (!parseResult.success) {
		const missingVars = parseResult.error.issues.map((issue) => issue.path.join(".")).join(", ");

		const requiredVars = Object.keys(envSchema.shape).join(", ");

		throw new ValidationError(
			`Missing or invalid environment variables: ${missingVars}\n` +
				`Ensure .env file exists with: ${requiredVars}`,
			parseResult.error,
		);
	}

	return parseResult.data;
}
