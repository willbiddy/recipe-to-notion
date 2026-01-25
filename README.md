# recipe-to-notion

Save recipes to Notion without copying and pasting. Paste a URL from almost any recipe site and get a Notion page with the cover photo, ingredients grouped by shopping aisle, instructions, and AI-generated tags. Claude automatically analyzes each recipe to add cuisine tags, meal types, healthiness scores, ingredient categories, and a short description, so you can filter and search your collection later.

**Browser Extension Popup** - One-click recipe saving from any recipe page
<img src="docs/extension-popup.png" alt="Browser extension popup interface" width="600">

**Notion Gallery View** - Browse your recipe collection with cover photos, tags, and meal types
<img src="docs/notion-gallery.png" alt="Gallery view in Notion showing recipe cards with cover photos, tags, and meal types" width="600">

**Notion Recipe Page** - Individual recipe with properties, AI-generated description, and organized ingredients
<img src="docs/notion-recipe.png" alt="Individual recipe page in Notion with properties, AI-generated description, and ingredients list" width="600">

## How It Works

```
URL → Check duplicates → Scrape recipe (JSON-LD) → Claude scores/tags → Notion page
```

1. **Check Duplicates** — Before processing, checks if a recipe with the same URL or title already exists in your Notion database. If found, the tool rejects the duplicate and provides a link to the existing recipe.

2. **Scrape** — Fetches the page HTML and extracts structured recipe data from [JSON-LD](https://json-ld.org/) (`schema.org/Recipe`). Most recipe sites embed this for SEO, including paywalled sites like NYT Cooking. If JSON-LD isn't available, falls back to microdata attributes and common CSS class patterns.

3. **Tag** — Sends the recipe to Claude, which returns tags, meal type, healthiness score (0-10), time estimate, description, and ingredient categories grouped by shopping aisle.

4. **Save** — Creates a Notion page with all properties, cover image, AI description, ingredients grouped by shopping category, and numbered instructions.

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- An [Anthropic API key](https://console.anthropic.com/)
- A [Notion integration](https://www.notion.so/my-integrations) with a connected database

## Cost

Each recipe costs about **$0.01** in Claude API usage (roughly 3,000-3,500 input tokens and 200-400 output tokens per recipe, including ingredient categorization). The default model is Sonnet, but you can change it in `src/tagger.ts` — Haiku is faster and cheaper, Opus is more capable but costs more.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/willbiddy/recipe-to-notion.git
cd recipe-to-notion
bun install
```

### 2. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration.
2. Copy the **Internal Integration Secret** (starts with `ntn_`).

### 3. Create a Notion database

Create a new full-page database in Notion with these properties: "Name" (Title), "Source" (URL), "Author" (Rich text), "Minutes" (Number), "Tags" (Multi-select), "Meal type" (Multi-select), "Healthiness" (Number). Connect your integration to the database via the `...` menu → Connections.

### 4. Get your database ID

The database ID is the 32-character hex string in your database URL (`https://www.notion.so/yourworkspace/DATABASE_ID_HERE?v=...`). Copy just the ID portion (with or without dashes).

### 5. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
NOTION_API_KEY=ntn_...
NOTION_DATABASE_ID=abc123...
```

## Deployment

The recipe-to-notion server can be deployed to the cloud so you don't need to run it locally. This is especially useful for the browser extension.

### Vercel (Recommended)

Vercel provides a free tier with excellent Bun runtime support. The code is already configured for Vercel deployment.

#### Quick Deploy

1. Login: `bunx vercel login`
2. Deploy: `bunx vercel --prod`
3. Add environment variables in Vercel dashboard (Settings → Environment Variables): `ANTHROPIC_API_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`
4. Update browser extension config with your deployment URL

**Note:** Vercel's free tier has a 60-second execution limit (sufficient for most recipes).

### Other Deployment Options

The server can also be deployed to Railway, Fly.io, Render, DigitalOcean, or any VPS. Use `cli-server.ts` as the entry point (defaults to port 3000, configurable via `SERVER_PORT`).

## Usage

There are three ways to use recipe-to-notion:

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

**Setup:**

1. Build: `bun run build:extension`
2. Choose server option:
   - **Local:** Start `bun run server`, set `SERVER_URL` in `extension/config.ts` to `"http://localhost:3000"`
   - **Vercel (Recommended):** Deploy to Vercel (see [Deployment](#deployment) above), set `SERVER_URL` to your deployment URL
3. Rebuild and reload: `bun run build:extension`, then reload extension in Chrome
4. Load in Chrome: `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `extension/` directory

Navigate to any recipe page, click the extension icon, then "Save Recipe". The extension uses Server-Sent Events (SSE) for real-time progress updates.

### 3. HTTP API

Use the REST API to integrate recipe-to-notion into your own applications or scripts:

```bash
# Health check
curl https://your-server.com/api/health

# Process a recipe (non-streaming)
curl -X POST https://your-server.com/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"url": "https://cooking.nytimes.com/recipes/1234-example"}'

# Process with Server-Sent Events for progress updates
curl -X POST https://your-server.com/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/recipe", "stream": true}'
```

**Endpoints:** `POST /api/recipes` (body: `{ "url": string, "stream"?: boolean }`) and `GET /api/health`

## Architecture

All entry points share the same core pipeline (`src/index.ts: processRecipe()`). Flow: URL → Duplicate Check → Scrape (Cheerio + JSON-LD/HTML) → AI Analysis (Claude) → Create Notion Page.

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
├── system-prompt.md   Claude instructions for recipe analysis
└── parsers/
    ├── json-ld.ts     JSON-LD (schema.org) recipe parsing
    ├── html.ts        HTML/microdata fallback parsing
    └── shared.ts      Shared utilities (type guards, helpers)

api/                   Vercel serverless functions
├── health.ts         Health check endpoint
└── recipes.ts        Recipe processing endpoint

extension/
├── manifest.json      Chrome extension manifest (Manifest V3)
├── popup.html         Extension popup UI (with Tailwind classes)
├── popup.ts           Popup logic and API communication
├── background.ts      Service worker for context menu
├── config.ts          Server URL configuration management
├── input.css          Tailwind CSS source file
├── styles.css         Compiled Tailwind CSS (generated)
└── icons/             Extension icons (SVG source files)
```

**Technologies:** Bun, TypeScript, Vercel, Cheerio, Anthropic SDK, Notion SDK, Citty, Consola, Zod, Tailwind CSS, SSE, Biome

## Scripts

- `bun run start` / `bun src/cli.ts` - CLI tool
- `bun run server` - Local HTTP server
- `bun run build:extension` - Build extension
- `bun run typecheck` / `lint` / `format` - Code quality

