/**
 * Serves the web interface index page.
 * This allows the root path (/) to serve the HTML file from public/.
 */

export default {
	async fetch(): Promise<Response> {
		try {
			// Read the index.html file from public directory
			// Using Bun's file system API
			const file = Bun.file("public/index.html");
			const html = await file.text();

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
