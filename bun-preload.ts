/**
 * Bun preload configuration for Solid.js JSX transformation.
 * This enables Solid.js JSX/TSX support in Bun.
 */

import { SolidPlugin } from "@dschz/bun-plugin-solid";

await Bun.plugin(
	SolidPlugin({
		generate: "dom",
		hydratable: false,
		debug: false,
	}),
);
