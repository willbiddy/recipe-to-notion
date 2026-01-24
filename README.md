# recipe-to-notion

Save recipes to Notion without copying and pasting. Paste a URL from almost any recipe site and get a Notion page with the cover photo, ingredients, instructions, and AI-generated tags. Claude automatically analyzes each recipe to add cuisine tags, meal types, healthiness scores, and a short description, so you can filter and search your collection later.

![Gallery view in Notion showing recipe cards with cover photos, tags, and meal types](docs/notion-gallery.png)

![Individual recipe page in Notion with properties, AI-generated description, and ingredients list](docs/notion-recipe.png)

## How It Works

```
URL → Check duplicates → Scrape recipe (JSON-LD) → Claude scores/tags → Notion page
```

1. **Check Duplicates** — Before processing, checks if a recipe with the same URL or title already exists in your Notion database. If found, the tool rejects the duplicate and provides a link to the existing recipe.

2. **Scrape** — Fetches the page HTML and extracts structured recipe data from [JSON-LD](https://json-ld.org/) (`schema.org/Recipe`). Most recipe sites embed this for SEO, including paywalled sites like NYT Cooking. If JSON-LD isn't available, falls back to microdata attributes and common CSS class patterns.

3. **Tag** — Sends the recipe name, ingredients, and instructions to Claude (`claude-sonnet-4-5-20250929`), which returns:
   - **Tags** — 1-4 tags for cuisine, dish type, and main ingredient (e.g. Italian, Pasta, Chicken)
   - **Meal type** — Breakfast, Lunch, Dinner, Snack, Dessert, Appetizer, Side Dish, or Component
   - **Healthiness** — 0-10 scale (0 = junk food, 10 = balanced whole-food meal)
   - **Minutes** — Total time estimate (uses scraped value if available, otherwise AI estimates)
   - **Description** — Brief 2-3 sentence summary of the dish

4. **Save** — Creates a Notion page in your database with:
   - All properties filled in (name, URL, author, time, scores, tags)
   - The recipe's hero image as the page cover
   - AI-generated description at the top of the page body
   - Ingredients as a bulleted list
   - Instructions as a numbered list

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- An [Anthropic API key](https://console.anthropic.com/)
- A [Notion integration](https://www.notion.so/my-integrations) with a connected database

## Cost

Each recipe costs about **$0.01 or less** in Claude API usage (roughly 2,000 input tokens and 100 output tokens per recipe).

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

## Usage

```bash
# Single recipe
bun src/cli.ts https://cooking.nytimes.com/recipes/1234-example

# Multiple recipes
bun src/cli.ts url1 url2 url3

# If a site blocks requests (403 error), save the page source and use --html
bun src/cli.ts --html ~/Downloads/recipe.html "https://example.com/recipe-url"
```

When processing multiple URLs, each is processed sequentially. Failures (duplicates, scraping errors) don't stop execution - all URLs are attempted.

### Example output

```
◐ Checking for duplicates...
✔ No duplicate URL found
◐ Scraping recipe...
✔ Scraped: Chicken Tikka Masala
◐ Generating AI scores and tags...
✔ Tagged recipe

Chicken Tikka Masala
Author:      Melissa Clark
Tags:        Indian, Curry, Chicken
Meal type:   Dinner
Healthiness: 6/10
Minutes:     45
Ingredients: 18 items
Steps:       8 steps

◐ Saving to Notion...
✔ Saved to Notion: https://www.notion.so/abc123def456...
```

## Notion Views

Once you have a few recipes, create custom Notion views to browse your collection. Some ideas:

- Gallery view with cover photos
- "Quick meals" filter for recipes under 30 minutes
- "Healthy meals" filter using the healthiness score

## Building a standalone binary

```bash
bun build src/cli.ts --compile --outfile recipe-to-notion
./recipe-to-notion https://example.com/recipe
```

## Project Structure

```
src/
├── cli.ts             Command-line interface and progress logging
├── index.ts           Pipeline orchestration for programmatic use
├── scraper.ts         Recipe extraction from URLs and HTML files
├── tagger.ts          Claude API integration for AI tagging
├── notion.ts          Notion page creation and duplicate detection
├── config.ts          Environment variable validation
└── system-prompt.md   Claude instructions for recipe analysis
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Bun](https://bun.sh/) | Runtime and package manager |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Cheerio](https://cheerio.js.org/) | HTML parsing and scraping |
| [Anthropic SDK](https://docs.anthropic.com/en/api/client-sdks) | Claude API for AI tagging |
| [Notion SDK](https://github.com/makenotion/notion-sdk-js) | Notion API client |
| [Commander](https://github.com/tj/commander.js) | CLI argument parsing |
| [Consola](https://github.com/unjs/consola) | Console logging with spinners |
| [Zod](https://zod.dev/) | Schema validation for env vars and API responses |
| [Biome](https://biomejs.dev/) | Linting and formatting |
