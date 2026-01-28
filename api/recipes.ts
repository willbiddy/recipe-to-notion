/**
 * Main handler for the /api/recipes endpoint with detailed error diagnostics.
 */

let moduleLoadError: { message: string; stack?: string } | null = null;
const modules: any = {};

// Try to load each module individually to identify which one fails
try {
	modules.HttpStatus = await import("../backend/server-shared/constants.js").then((m) => ({
		HttpStatus: m.HttpStatus,
	}));
	modules.errors = await import("../backend/server-shared/errors.js");
	modules.headers = await import("../backend/server-shared/headers.js");
	// This is likely where it fails - recipe-handler imports many backend modules
	modules.recipeHandler = await import("../backend/server-shared/recipe-handler.js");
} catch (error) {
	moduleLoadError = {
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	};
}

const { HttpStatus } = modules.HttpStatus || {};
const { createErrorResponse, generateRequestId } = modules.errors || {};
const { handleOptionsRequest } = modules.headers || {};
const { handleRecipeRequest } = modules.recipeHandler || {};

export default {
	async fetch(req: Request): Promise<Response> {
		// Return detailed error if module loading failed
		if (moduleLoadError) {
			return new Response(
				JSON.stringify(
					{
						error: "Module loading failed",
						message: moduleLoadError.message,
						stack: moduleLoadError.stack,
						loadedModules: Object.keys(modules),
					},
					null,
					2,
				),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const requestId = generateRequestId();

		if (req.method === "OPTIONS") {
			return handleOptionsRequest(req);
		}

		if (req.method !== "POST") {
			return createErrorResponse("Method not allowed", HttpStatus.MethodNotAllowed, true);
		}

		function createLoggedErrorResponse(error: string, status: number): Response {
			console.error(`[${requestId}] Request error: ${error}`);
			return createErrorResponse(error, status, true);
		}

		try {
			return await handleRecipeRequest({
				request: req,
				requestId,
				createErrorResponse: createLoggedErrorResponse,
				includeFullDataInStream: true,
			});
		} catch (error) {
			console.error(`[${requestId}] Recipe processing error:`, error);
			const { handleRecipeError, logErrorDetails } = await import(
				"../backend/server-shared/errors.js"
			);
			logErrorDetails(error, { error: console.error }, requestId);
			return handleRecipeError(error, { error: console.error }, requestId);
		}
	},
};
