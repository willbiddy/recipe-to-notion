/**
 * Main handler for the /api/recipes endpoint.
 */

// Wrap all imports in try-catch to diagnose module loading issues
const imports: any = {};
try {
	imports.consola = await import("consola").then((m) => m.consola);
	imports.HttpStatus = await import("../backend/server-shared/constants.js").then(
		(m) => m.HttpStatus,
	);
	imports.createErrorResponse = await import("../backend/server-shared/errors.js").then(
		(m) => m.createErrorResponse,
	);
	imports.generateRequestId = await import("../backend/server-shared/errors.js").then(
		(m) => m.generateRequestId,
	);
	imports.handleOptionsRequest = await import("../backend/server-shared/headers.js").then(
		(m) => m.handleOptionsRequest,
	);
	imports.handleRecipeRequest = await import("../backend/server-shared/recipe-handler.js").then(
		(m) => m.handleRecipeRequest,
	);
} catch (error) {
	// Module loading failed - this will be caught by the fetch handler
	imports.error = error instanceof Error ? error.message : String(error);
	imports.stack = error instanceof Error ? error.stack : undefined;
}

const {
	consola,
	HttpStatus,
	createErrorResponse,
	generateRequestId,
	handleOptionsRequest,
	handleRecipeRequest,
} = imports;

export default {
	/**
	 * Vercel serverless function handler.
	 *
	 * @param req - The incoming request.
	 * @returns Response with recipe processing result or error.
	 */
	async fetch(req: Request): Promise<Response> {
		// Check if module loading failed
		if (imports.error) {
			return new Response(
				JSON.stringify({
					error: "Module loading failed",
					message: imports.error,
					stack: imports.stack,
				}),
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
			consola.error(`[${requestId}] Request error: ${error}`);
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
			consola.error(`[${requestId}] Recipe processing error:`, error);
			const { handleRecipeError, logErrorDetails } = await import(
				"../backend/server-shared/errors.js"
			);
			logErrorDetails(error, { error: consola.error }, requestId);
			return handleRecipeError(error, { error: consola.error }, requestId);
		}
	},
};
