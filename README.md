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

3. **Tag** — Sends the recipe name, ingredients, and instructions to Claude, which returns:
   - **Tags** — 1-4 tags for cuisine, dish type, and main ingredient (e.g. Italian, Pasta, Chicken)
   - **Meal type** — Breakfast, Lunch, Dinner, Snack, Dessert, Appetizer, Side Dish, or Component
   - **Healthiness** — 0-10 scale (0 = junk food, 10 = balanced whole-food meal)
   - **Minutes** — Total time estimate (uses scraped value if available, otherwise AI estimates)
   - **Description** — Brief 2-3 sentence summary of the dish
   - **Ingredient categories** — Each ingredient categorized by shopping aisle (Produce, Meat & Seafood, Pantry, Dairy & Eggs)

4. **Save** — Creates a Notion page in your database with:
   - All properties filled in (name, URL, author, time, scores, tags)
   - The recipe's hero image as the page cover
   - AI-generated description at the top of the page body
   - Ingredients grouped by shopping category (Produce → Meat & Seafood → Pantry → Dairy & Eggs)
   - Instructions as a numbered list

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

Create a new full-page database in Notion. You can add the required properties manually:

| Property    | Type         | Description                    |
|-------------|--------------|--------------------------------|
| Name        | Title        | Recipe name                    |
| Source      | URL          | Link to original recipe        |
| Author      | Rich text    | Recipe author (if available)   |
| Minutes     | Number       | Total time in minutes          |
| Tags        | Multi-select | e.g. Italian, Pasta, Chicken   |
| Meal type   | Multi-select | e.g. Dinner, Snack             |
| Healthiness | Number       | 0-10                           |

### 4. Connect the integration to your database

1. Open the database page in Notion.
2. Click the `...` menu in the top-right corner.
3. Under **Connections**, find and add your integration.

### 5. Get your database ID

The database ID is the 32-character hex string in the database URL:

```
https://www.notion.so/yourworkspace/DATABASE_ID_HERE?v=...
```

Copy just the ID portion (with or without dashes).

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
```

## Deployment

The recipe-to-notion server can be deployed to the cloud so you don't need to run it locally. This is especially useful for the browser extension.

### Vercel (Recommended)

Vercel provides a free tier with excellent Bun runtime support. The code is already configured for Vercel deployment.

#### Quick Deploy

1. **Login to Vercel:**
   ```bash
   bunx vercel login
   ```

2. **Deploy:**
   ```bash
   bunx vercel --prod
   ```

3. **Add environment variables:**
   - Go to your project settings on [vercel.com](https://vercel.com)
   - Navigate to Settings → Environment Variables
   - Add: `ANTHROPIC_API_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`
   - Select all environments (Production, Preview, Development)
   - Redeploy after adding variables (or wait for auto-deploy)

4. **Get your deployment URL:**
   - Vercel will provide a URL like `https://recipe-to-notion-xi.vercel.app`
   - Update your browser extension config to use this URL

**Note:** Vercel's free tier has a 60-second execution limit per function call, which is sufficient for most recipes (processing typically takes 30-45 seconds).

#### Testing Your Deployment

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Test recipe processing
curl -X POST https://your-app.vercel.app/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"url": "https://cooking.nytimes.com/recipes/1234-example"}'
```

### Other Deployment Options

The server can also be deployed to Railway, Fly.io, Render, DigitalOcean, or any VPS. Use `cli-server.ts` as the entry point (defaults to port 3000, configurable via `SERVER_PORT`).

## Usage

There are two ways to use recipe-to-notion:

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

### 2. HTTP API

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

**API Endpoints:**
- `POST /api/recipes` - Process and save a recipe
  - Request body: `{ "url": string, "stream"?: boolean }`
  - Response: `{ "success": boolean, "pageId"?: string, "notionUrl"?: string, "error"?: string }`
  - With `stream: true`, returns Server-Sent Events (SSE) with progress updates
- `GET /api/health` - Health check endpoint
  - Response: `{ "status": "ok", "service": "recipe-to-notion" }`

## Browser Extension

Save recipes with one click directly from your browser!

### Option A: Local Server Setup

1. **Build the extension:**
   ```bash
   bun run build:extension
   ```
   This compiles TypeScript files and Tailwind CSS for the extension UI.

2. **Start the local server:**
   ```bash
   bun run server
   ```
   The server runs on `http://localhost:3000` by default (configurable via `SERVER_PORT` env var).

3. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension/` directory

4. **Configure the extension:**
   - Edit `extension/config.ts` and set `SERVER_URL` to `"http://localhost:3000"`
   - Rebuild: `bun run build:extension`
   - Reload the extension in Chrome

### Option B: Vercel Deployment (Recommended)

Deploy the server to Vercel so you don't need to run a local server. See the [Deployment](#deployment) section below for instructions.

1. **Build the extension:**
   ```bash
   bun run build:extension
   ```

2. **Configure the extension:**
   - Edit `extension/config.ts` and set `SERVER_URL` to your Vercel deployment URL (e.g., `"https://recipe-to-notion-xi.vercel.app"`)
   - Rebuild: `bun run build:extension`
   - Reload the extension in Chrome

3. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension/` directory

### Usage

1. Navigate to any recipe page in your browser
2. Click the extension icon in the toolbar
3. Click "Save Recipe"
4. The recipe will be processed and saved to your Notion database
5. A new tab will open with the saved recipe page

The extension uses Server-Sent Events (SSE) to show real-time progress updates while processing recipes.

## Ingredient Organization

Ingredients are automatically grouped by shopping category: Produce → Deli & Bakery → Meat & Seafood → Pantry → Snacks & Soda → Dairy & Eggs → Frozen Foods.


## Architecture & Tech Stack

All entry points (CLI, HTTP server, Vercel functions, browser extension) share the same core pipeline (`src/index.ts: processRecipe()`), ensuring consistent behavior across all interfaces.

**Processing Flow:**
```
URL Input
  ↓
Duplicate Check (Notion API)
  ↓
Scrape Recipe (Cheerio + JSON-LD/HTML parsers)
  ↓
AI Analysis (Claude API)
  ↓
Create Notion Page (Notion API)
```

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

**Technologies:**

| Technology | Purpose |
|------------|---------|
| [Bun](https://bun.sh/) | Runtime and package manager |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Vercel](https://vercel.com/) | Serverless deployment platform (optional, for cloud hosting) |
| [Cheerio](https://cheerio.js.org/) | HTML parsing and scraping |
| [Anthropic SDK](https://docs.anthropic.com/en/api/client-sdks) | Claude API for AI tagging |
| [Notion SDK](https://github.com/makenotion/notion-sdk-js) | Notion API client |
| [Citty](https://github.com/unjs/citty) | CLI argument parsing |
| [Consola](https://github.com/unjs/consola) | Console logging with spinners and colors |
| [Zod](https://zod.dev/) | Schema validation for env vars and API responses |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework for extension UI |
| [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) | Real-time progress updates in browser extension |
| [Biome](https://biomejs.dev/) | Linting and formatting |

## Scripts

- `bun run start` or `bun src/cli.ts` - Run the CLI tool
- `bun run server` - Start the local HTTP server for the browser extension
- `bun run build:extension` - Compile TypeScript extension files and Tailwind CSS
- `bun run typecheck` - Type check without emitting files
- `bun run lint` - Lint code with Biome
- `bun run format` - Format code with Biome

