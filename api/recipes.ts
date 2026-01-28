/**
 * Diagnostic version to identify failing imports
 */
let loadError: { message: string; stack?: string; loaded: string[] } | null = null;
const loaded: string[] = [];

try {
	await import("../backend/server-shared/constants.js");
	loaded.push("constants");

	await import("../backend/server-shared/errors.js");
	loaded.push("errors");

	await import("../backend/server-shared/headers.js");
	loaded.push("headers");

	await import("../backend/config.js");
	loaded.push("config");

	await import("../backend/logger.js");
	loaded.push("logger");

	await import("../backend/rate-limit.js");
	loaded.push("rate-limit");

	await import("../backend/process-recipe.js");
	loaded.push("process-recipe");

	await import("../backend/server-shared/recipe-handler.js");
	loaded.push("recipe-handler");
} catch (error) {
	loadError = {
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		loaded,
	};
}

export default {
	fetch(_req: Request): Response {
		if (loadError) {
			return new Response(JSON.stringify(loadError, null, 2), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(
			JSON.stringify({ success: true, message: "All modules loaded!", loaded }, null, 2),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	},
};
