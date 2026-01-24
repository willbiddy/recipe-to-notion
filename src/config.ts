import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  NOTION_API_KEY: z.string().min(1, "NOTION_API_KEY is required"),
  NOTION_DATABASE_ID: z.string().min(1, "NOTION_DATABASE_ID is required"),
});

/** Validated environment configuration containing all required API keys. */
export type Config = z.infer<typeof envSchema>;

/**
 * Loads and validates required environment variables from the process environment.
 * Bun automatically loads `.env` files, so no dotenv import is needed.
 *
 * @returns Validated configuration object with API keys and database ID.
 * @throws If any required environment variable is missing or empty.
 */
export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Missing or invalid environment variables: ${missing}\n` +
        `Ensure .env file exists with ANTHROPIC_API_KEY, NOTION_API_KEY, and NOTION_DATABASE_ID`
    );
  }
  return result.data;
}
