/**
 * Serves the web interface index page.
 * This allows the root path (/) to serve the HTML file from public/.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export default {
	async fetch(): Promise<Response> {
		try {
			// Read the index.html file from public directory
			const indexPath = join(process.cwd(), "public", "index.html");
			const html = readFileSync(indexPath, "utf-8");

			return new Response(html, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		} catch (error) {
			console.error("Error serving index.html:", error);
			return new Response("Not Found", { status: 404 });
		}
	},
};
