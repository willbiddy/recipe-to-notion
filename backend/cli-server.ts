#!/usr/bin/env bun
/**
 * CLI entry point for starting the recipe-to-notion HTTP server.
 *
 * Usage:
 *   bun backend/cli-server.ts
 *   SERVER_PORT=8080 bun backend/cli-server.ts
 */
import { colors } from "@shared/colors";
import { DEFAULT_PORT, IDLE_TIMEOUT_SECONDS, MAX_PORT, MIN_PORT } from "@shared/constants";
import getPort from "get-port";
import { ValidationError } from "./errors.js";
import { handleRequest } from "./server.js";
import { HttpStatus } from "./server-shared/http-utils.js";

try {
	const { loadConfig } = await import("./config.js");
	loadConfig();
} catch (error) {
	console.log(
		colors.red(
			`${error instanceof Error ? error.message : String(error)}\nMake sure your .env file is configured with ANTHROPIC_API_KEY, NOTION_API_KEY, NOTION_DATABASE_ID, and API_SECRET`,
		),
	);
	process.exit(1);
}

/**
 * Validates and parses the port from environment variable or returns default.
 *
 * @param envPort - Port value from environment variable.
 * @returns Valid port number.
 * @throws If port is invalid.
 */
function parsePort(envPort: string | undefined): number {
	if (!envPort) {
		return DEFAULT_PORT;
	}

	const port = Number.parseInt(envPort, 10);

	if (Number.isNaN(port) || port < MIN_PORT || port > MAX_PORT) {
		throw new ValidationError(
			`Invalid port: ${envPort}. Must be between ${MIN_PORT} and ${MAX_PORT}.`,
		);
	}

	return port;
}

/**
 * Gets an available port, either the requested one or an alternative if it's in use.
 *
 * @param requestedPort - The port number to try first.
 * @returns An available port number.
 */
async function getAvailablePort(requestedPort: number): Promise<number> {
	const port = await getPort({ port: requestedPort });

	if (port !== requestedPort) {
		console.log(
			colors.yellow(
				`Port ${requestedPort} is in use. Using next available port: ${port}\nTo use a specific port, stop the process using it first.`,
			),
		);
	}

	return port;
}

/**
 * Handles graceful server shutdown.
 *
 * @param server - The Bun server instance to stop.
 * @param signal - The signal that triggered the shutdown.
 */
function handleShutdown(server: ReturnType<typeof Bun.serve>, signal: string): void {
	console.log(`\nReceived ${signal}, shutting down server...`);
	server.stop();
	process.exit(0);
}

let requestedPort: number;
try {
	requestedPort = parsePort(process.env.SERVER_PORT);
} catch (error) {
	console.log(colors.red(error instanceof Error ? error.message : String(error)));
	process.exit(1);
}

const port: number = await getAvailablePort(requestedPort);

/**
 * Starts the HTTP server.
 *
 * @param port - The port number to listen on.
 * @returns The Bun server instance.
 * @throws If server fails to start.
 */
function startServer(port: number): ReturnType<typeof Bun.serve> {
	const server = Bun.serve({
		port,
		fetch: handleRequest,
		idleTimeout: IDLE_TIMEOUT_SECONDS,
		error(error: Error): Response {
			console.log(colors.red(`Server error: ${error.message}`));
			return new Response("Internal Server Error", { status: HttpStatus.InternalServerError });
		},
	});

	console.log(colors.green(`recipe-to-notion server running on http://localhost:${port}`));
	console.log("Endpoints:");
	console.log(`POST http://localhost:${port}/api/recipes`);
	console.log(`GET http://localhost:${port}/health`);

	return server;
}

let server: ReturnType<typeof Bun.serve>;
try {
	server = startServer(port);
} catch (error) {
	const errorMessage = error instanceof Error ? error.message : String(error);
	console.log(colors.red(`Failed to start server: ${errorMessage}`));
	process.exit(1);
}

process.on("SIGINT", () => handleShutdown(server, "SIGINT"));
process.on("SIGTERM", () => handleShutdown(server, "SIGTERM"));
