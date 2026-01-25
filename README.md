# recipe-to-notion

Save recipes to Notion without copying and pasting. Paste a URL from almost any recipe site and get a Notion page with the cover photo, ingredients grouped by shopping aisle, instructions, and AI-generated tags. Claude automatically analyzes each recipe to add cuisine tags, meal types, healthiness scores, ingredient categories, and a short description, so you can filter and search your collection later.

**Browser Extension Popup** - One-click recipe saving from any recipe page
<img src="docs/extension-popup.png" alt="Browser extension popup interface">

**Notion Gallery View** - Browse your recipe collection with cover photos, tags, and meal types
<img src="docs/notion-gallery.png" alt="Gallery view in Notion showing recipe cards with cover photos, tags, and meal types">

**Notion Recipe Page** - Individual recipe with properties, AI-generated description, and organized ingredients
<img src="docs/notion-recipe.png" alt="Individual recipe page in Notion with properties, AI-generated description, and ingredients list">

## How It Works

```
CLI/Extension/Web/API → Check duplicates → Scrape recipe → Claude scores/tags → Notion page
```

1. **CLI/Extension/Web/API** — Recipe URL is provided via CLI command, browser extension click, web interface, or HTTP API request.

2. **Check duplicates** — Before processing, checks if a recipe with the same URL or title already exists in your Notion database. If found, the tool rejects the duplicate and provides a link to the existing recipe.

3. **Scrape recipe** — Fetches the page HTML and extracts structured recipe data from [JSON-LD](https://json-ld.org/) (`schema.org/Recipe`). Most recipe sites embed this for SEO, including paywalled sites like NYT Cooking. If JSON-LD isn't available, falls back to microdata attributes and common CSS class patterns.

4. **Claude scores/tags** — Sends the recipe to Claude, which returns tags, meal type, healthiness score (0-10), time estimate, description, and ingredient categories grouped by shopping aisle.

5. **Notion page** — Creates a Notion page with all properties, cover image, AI description, ingredients grouped by shopping category, and numbered instructions.

## Cost

Each recipe costs about **$0.03** in Claude API usage (roughly 4,000-7,000 input tokens and 200-1,000 output tokens per recipe). The default model is Sonnet 4.5, but you can change it in `src/tagger.ts` — Haiku is faster and cheaper, Opus is more capable but costs more.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/willbiddy/recipe-to-notion.git
cd recipe-to-notion
bun install
```

### 2. Create an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com/) and sign in or create an account.
2. Navigate to **API Keys** in the sidebar.
3. Click **Create Key** and give it a name (e.g., "recipe-to-notion").
4. Copy the API key (starts with `sk-ant-`). You won't be able to see it again, so save it securely.

### 3. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration.
2. Copy the **Internal Integration Secret** (starts with `ntn_`).

### 4. Create a Notion database

1. In Notion, create a new page and select **Table** → **Full page**.
2. Add the following properties to your database:
   - **"Name"** - Type: Title (this is the default property)
   - **"Source"** - Type: URL
   - **"Author"** - Type: Text
   - **"Minutes"** - Type: Number
   - **"Tags"** - Type: Multi-select
   - **"Meal type"** - Type: Multi-select
   - **"Healthiness"** - Type: Number
3. Connect your integration to the database:
   - Click the `...` menu in the top-right of the database
   - Select **Connections**
   - Choose your integration from the list

### 5. Get your database ID

The database ID is the 32-character hex string in your database URL (`https://www.notion.so/yourworkspace/DATABASE_ID_HERE?v=...`). Copy just the ID portion (with or without dashes).

### 6. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
NOTION_API_KEY=ntn_...
NOTION_DATABASE_ID=abc123...
API_SECRET=your-secret-api-key-here
```

> **Note:** The `API_SECRET` is required for API authentication. Use a strong, random value (e.g., generate with `openssl rand -hex 32`). This prevents unauthorized access to your API endpoints.

## Documentation

📚 **Detailed Guides:**
- **[Browser Extension Setup](docs/EXTENSION.md)** - Complete guide for setting up and using the browser extension
- **[Web Interface Guide](docs/WEB_INTERFACE.md)** - Mobile-friendly web interface for saving recipes from any device
- **[iOS Shortcut Setup](docs/IOS_SHORTCUT.md)** - Set up iOS Share Sheet integration
- **[API Reference](docs/API.md)** - Full REST API documentation with examples
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to Vercel

---

## Usage

There are four ways to use recipe-to-notion:

### 1. Command Line Interface (CLI)

The simplest way to save recipes from the terminal:

```bash
# Single recipe
bun src/cli.ts https://cooking.nytimes.com/recipes/1234-example

# Multiple recipes
bun src/cli.ts url1 url2 url3

# If a site blocks requests (403 error), save the page source and use --html
bun src/cli.ts --html ~/Downloads/recipe.html "https://example.com/recipe-url"
```

When processing multiple URLs, each is processed sequentially. Failures (duplicates, scraping errors) don't stop execution - all URLs are attempted.

### 2. Browser Extension

Save recipes with one click directly from your browser!

> 📖 See [Extension Setup Guide](docs/EXTENSION.md) for complete setup instructions.
>
> **Quick Start:** Deploy to Vercel (see [Deployment Guide](docs/DEPLOYMENT.md)), then build and load the extension.

### 3. Web Interface

Save recipes from your phone or any device using the mobile-friendly web interface. Works with iOS Share Sheet (via Shortcuts) and Android Share Sheet (native).

> 📖 See [Web Interface Guide](docs/WEB_INTERFACE.md) for complete setup instructions, including iOS and Android sharing.
>
> **Quick Start:** Deploy to Vercel, build the web interface (`bun run build:web`), then access it at your Vercel URL.

### 4. HTTP API

Use the REST API to integrate recipe-to-notion into your own applications or scripts.

> 📖 **Full API Docs:** See [API Reference](docs/API.md) for complete endpoint documentation, request/response formats, and examples.

---

## Project Structure

```
src/
├── cli.ts             Command-line interface
├── cli-server.ts      HTTP server entry point (local development)
├── server.ts          HTTP server request handlers (shared logic)
├── index.ts           Pipeline orchestration for programmatic use
├── logger.ts          Shared logging interface and CLI logger implementation
├── scraper.ts         Recipe extraction from URLs and HTML files
├── tagger.ts          Claude API integration for AI tagging
├── notion.ts          Notion page creation and duplicate detection
├── config.ts          Environment variable validation
├── security.ts        Security utilities
├── system-prompt.md   Claude instructions for recipe analysis
└── parsers/
    ├── json-ld.ts     JSON-LD (schema.org) recipe parsing
    ├── html.ts        HTML/microdata fallback parsing
    └── shared.ts      Shared utilities (type guards, helpers)

api/                   Vercel serverless functions
├── health.ts          Health check endpoint
└── recipes.ts         Recipe processing endpoint

extension/
├── manifest.json      Chrome extension manifest (Manifest V3)
├── popup.html         Extension popup UI (with Tailwind classes)
├── popup.ts           Popup logic and API communication
├── background.ts      Service worker for context menu
├── config.ts          Server URL configuration management
├── tsconfig.json      TypeScript configuration for extension
├── input.css          Tailwind CSS source file
├── styles.css         Compiled Tailwind CSS (generated)
└── icons/             Extension icons (SVG source files)

public/                 Web interface (mobile-friendly)
├── index.html         Main web page
├── manifest.json      Web App Manifest (PWA + Share Target)
├── web.ts             Client-side TypeScript
├── web.js             Compiled JavaScript (generated)
├── input.css          Tailwind CSS source file
├── web.css            Compiled CSS (generated)
└── tsconfig.json      TypeScript configuration
```

**Technologies:**

- [Bun](https://bun.sh/) - JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) - Static typing
- [Vercel](https://vercel.com/) - Serverless hosting
- [Cheerio](https://cheerio.js.org/) - HTML parsing
- [Anthropic SDK](https://docs.anthropic.com/en/api/client-sdks) - Claude AI API client
- [Notion SDK](https://github.com/makenotion/notion-sdk-js) - Notion API client
- [Citty](https://github.com/unjs/citty) - CLI argument parsing
- [Consola](https://github.com/unjs/consola) - Logging
- [Zod](https://zod.dev/) - Schema validation
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) - Real-time updates
- [Biome](https://biomejs.dev/) - Linting & formatting

---

## Scripts

- **`bun run start`** / **`bun src/cli.ts`** - Run the CLI tool to save recipes from the command line
- **`bun run server`** - Start local HTTP server for development (runs on `localhost:3000`)
- **`bun run build:extension`** - Compile TypeScript and Tailwind CSS for the browser extension
- **`bun run build:web`** - Compile TypeScript and Tailwind CSS for the web interface
- **`bun run typecheck`** - Check TypeScript types for errors
- **`bun run lint`** - Run linter to find code issues
- **`bun run format`** - Auto-format code with Biome

---

## Credits

Icon attribution: <a href="https://www.flaticon.com/free-icons/cutlery" title="cutlery icons">Cutlery icons created by Freepik - Flaticon</a>

