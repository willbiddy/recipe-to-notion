import { z } from "zod";

/**
 * Environment variable schema for validation.
 * All fields are required and must be non-empty strings.
 */
const envSchema = z.object({
	ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
	NOTION_API_KEY: z.string().min(1, "NOTION_API_KEY is required"),
	NOTION_DATABASE_ID: z.string().min(1, "NOTION_DATABASE_ID is required"),
	API_SECRET: z.string().min(1, "API_SECRET is required"),
});

/**
 * Validated environment configuration containing all required API keys.
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Loads and validates required environment variables from the process environment.
 * Bun automatically loads `.env` files, so no dotenv import is needed.
 *
 * @returns Validated configuration object with API keys and database ID.
 * @throws If any required environment variable is missing or empty.
 */
/**
 * Loads and validates required environment variables from the process environment.
 * Bun automatically loads `.env` files, so no dotenv import is needed.
 *
 * @returns Validated configuration object with API keys and database ID.
 * @throws {Error} If any required environment variable is missing or empty.
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

		const requiredVars = [
			"ANTHROPIC_API_KEY",
			"NOTION_API_KEY",
			"NOTION_DATABASE_ID",
			"API_SECRET",
		].join(", ");

		throw new Error(
			`Missing or invalid environment variables: ${missingVars}\n` +
				`Ensure .env file exists with: ${requiredVars}`,
		);
	}

	return parseResult.data;
}
