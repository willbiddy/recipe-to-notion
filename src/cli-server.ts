#!/usr/bin/env bun
/**
 * CLI entry point for starting the recipe-to-notion HTTP server.
 *
 * Usage:
 *   bun src/cli-server.ts
 *   SERVER_PORT=8080 bun src/cli-server.ts
 */
import { consola } from "consola";
import { handleRequest } from "./server.js";

/**
 * HTTP status codes used in the server.
 */
enum HttpStatus {
	InternalServerError = 500,
}

const DEFAULT_PORT = 3000;
const port = parseInt(process.env.SERVER_PORT || String(DEFAULT_PORT), 10);

if (Number.isNaN(port) || port < 1 || port > 65535) {
	consola.fatal(`Invalid port: ${process.env.SERVER_PORT}. Must be between 1 and 65535.`);
	process.exit(1);
}

/**
 * Validate environment variables are loaded.
 * This will throw if env vars are missing.
 */
try {
	const { loadConfig } = await import("./config.js");
	loadConfig();
} catch (error) {
	consola.fatal(
		error instanceof Error ? error.message : String(error),
		"\nMake sure your .env file is configured with ANTHROPIC_API_KEY, NOTION_API_KEY, and NOTION_DATABASE_ID",
	);
	process.exit(1);
}

/**
 * Kills any process using the specified port.
 */
async function killProcessOnPort(port: number): Promise<boolean> {
	try {
		const { execSync } = await import("node:child_process");
		const pid = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
		if (pid) {
			consola.warn(`Port ${port} is in use by process ${pid}. Killing it...`);
			try {
				/**
				 * Try graceful kill first.
				 */
				execSync(`kill ${pid}`, { encoding: "utf-8", stdio: "ignore" });
				await new Promise((resolve) => setTimeout(resolve, 500));

				/**
				 * Check if still running, force kill if needed.
				 */
				try {
					execSync(`lsof -ti:${port}`, { encoding: "utf-8", stdio: "ignore" });
					/**
					 * Still running, force kill.
					 */
					execSync(`kill -9 ${pid}`, { encoding: "utf-8", stdio: "ignore" });
					await new Promise((resolve) => setTimeout(resolve, 500));
				} catch {
					/**
					 * Process is gone.
					 */
				}

				consola.success(`Process ${pid} killed`);
				return true;
			} catch (_killError) {
				consola.warn(`Failed to kill process ${pid}`);
				return false;
			}
		}
		/**
		 * Port not in use.
		 */
		return true;
	} catch (_error) {
		/**
		 * Port is not in use, or lsof failed (which is fine).
		 */
		return true;
	}
}

/**
 * Try to kill any process on the port before starting.
 */
await killProcessOnPort(port);

/**
 * Try to start the server, with retry logic if port is still in use.
 */
let server: ReturnType<typeof Bun.serve>;
let retries = 3;
let started = false;

while (retries > 0 && !started) {
	try {
		server = Bun.serve({
			port,
			fetch: handleRequest,
			/**
			 * 2 minutes - recipe processing can take 30+ seconds.
			 */
			idleTimeout: 120,
			/**
			 * Handle server errors.
			 */
			error(error) {
				consola.error(`Server error: ${error.message}`);
				return new Response("Internal Server Error", { status: HttpStatus.InternalServerError });
			},
		});

		consola.ready(`Recipe-to-Notion server running on http://localhost:${port}`);
		consola.info("Endpoints:");
		consola.info(`  POST http://localhost:${port}/api/recipes`);
		consola.info(`  GET  http://localhost:${port}/health`);
		started = true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (
			(errorMessage.includes("EADDRINUSE") || errorMessage.includes("address already in use")) &&
			retries > 1
		) {
			/**
			 * Port still in use, try killing again and retry.
			 */
			retries--;
			consola.warn(`Port ${port} still in use, retrying... (${retries} attempts left)`);
			await killProcessOnPort(port);
			await new Promise((resolve) => setTimeout(resolve, 1_000));
		} else {
			/**
			 * Final failure or non-port error.
			 */
			if (errorMessage.includes("EADDRINUSE") || errorMessage.includes("address already in use")) {
				consola.fatal(
					`Port ${port} is still in use after cleanup attempts.\n\n` +
						`  Options:\n` +
						`  1. Manually stop the process: lsof -i :${port} then kill -9 <PID>\n` +
						`  2. Use a different port: SERVER_PORT=8080 bun run server`,
				);
			} else {
				consola.fatal(`Failed to start server: ${errorMessage}`);
			}
			process.exit(1);
		}
	}
}

/**
 * Graceful shutdown handlers.
 */
process.on("SIGINT", () => {
	consola.info("\nShutting down server...");
	server.stop();
	process.exit(0);
});

process.on("SIGTERM", () => {
	consola.info("\nShutting down server...");
	server.stop();
	process.exit(0);
});
