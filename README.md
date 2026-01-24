# recipe-to-notion

A CLI tool that scrapes a recipe URL, generates AI scores and tags with Claude, and saves it to a Notion database with a cover photo and structured content.

## How It Works

```
URL → Scrape recipe (JSON-LD) → Claude scores/tags → Notion page
```

1. **Scrape** — Fetches the page HTML and extracts structured recipe data from [JSON-LD](https://json-ld.org/) (`schema.org/Recipe`). Most recipe sites embed this for SEO, including paywalled sites like NYT Cooking. If JSON-LD isn't available, falls back to microdata attributes and common CSS class patterns.

2. **Tag** — Sends the recipe name, ingredients, and instructions to Claude (`claude-sonnet-4-5-20250929`), which returns:
   - **Cuisine** — 1-3 categories (e.g. Italian, Indian, Fusion)
   - **Meal Type** — Breakfast, Lunch, Dinner, Snack, Dessert, Appetizer, or Side Dish
   - **Difficulty** — 0-10 scale (0 = no-cook assembly, 10 = professional techniques)
   - **Healthiness** — 0-10 scale (0 = junk food, 10 = balanced whole-food meal)

3. **Save** — Creates a Notion page in your database with:
   - All properties filled in (name, URL, time, servings, scores, tags)
   - The recipe's hero image as the page cover
   - Ingredients as a bulleted list in the page body
   - Instructions as a numbered list in the page body

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- An [Anthropic API key](https://console.anthropic.com/)
- A [Notion integration](https://www.notion.so/my-integrations) with a connected database

## Setup

### 1. Clone and install

```bash
cd ~/recipe-to-notion
bun install
```

### 2. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration.
2. Copy the **Internal Integration Secret** (starts with `ntn_`).

### 3. Create a Notion database

Create a new full-page database in Notion. The `--setup` command will create the required properties for you, but you can also add them manually:

| Property    | Type         | Description                    |
|-------------|--------------|--------------------------------|
| Name        | Title        | Recipe name                    |
| Source URL  | URL          | Link to original recipe        |
| Total Time  | Number       | Minutes                        |
| Servings    | Rich text    | e.g. "4 servings"             |
| Cuisine     | Multi-select | e.g. Italian, Indian           |
| Meal Type   | Multi-select | e.g. Dinner, Snack             |
| Difficulty  | Number       | 0-10                           |
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

### 7. Initialize database properties

```bash
bun src/cli.ts --setup
```

This ensures your database has all the required property columns with the correct types.

## Usage

### Process a recipe and save to Notion

```bash
bun src/cli.ts https://cooking.nytimes.com/recipes/1234-example
```

### Dry run (scrape + tag, no Notion save)

```bash
bun src/cli.ts --dry-run https://example.com/recipe
```

This is useful for testing that scraping and AI tagging work before committing to Notion.

### Example output

```
◐ Scraping recipe...
✔ Scraped: Chicken Tikka Masala
◐ Generating AI scores and tags...
✔ Tagged recipe

╭──────────────────────────────╮
│                              │
│  Chicken Tikka Masala        │
│                              │
│  Cuisine:     Indian         │
│  Meal Type:   Dinner         │
│  Difficulty:  5/10           │
│  Healthiness: 6/10           │
│  Total Time:  45 min         │
│  Servings:    4 servings     │
│  Ingredients: 18 items       │
│  Steps:       8 steps        │
│                              │
╰──────────────────────────────╯

◐ Saving to Notion...
✔ Saved to Notion (page ID: abc123-def456...)
```

## Recommended Notion Views

After adding a few recipes, create these views in your Notion database for a better browsing experience:

1. **Gallery** — Gallery view showing cover photos with Name, Cuisine, and scores visible.
2. **Quick Meals** — Table view filtered to `Total Time ≤ 30`, sorted by Total Time ascending.
3. **Healthiest** — Table view sorted by Healthiness descending.
4. **By Cuisine** — Board view grouped by Cuisine.
5. **By Meal Type** — Board view grouped by Meal Type.

## Building a standalone binary

```bash
bun build src/cli.ts --compile --outfile recipe-to-notion
./recipe-to-notion https://example.com/recipe
```

## Project Structure

```
src/
├── cli.ts        CLI entry point (commander + consola logging)
├── index.ts      Orchestrator connecting scrape → tag → save
├── scraper.ts    Recipe extraction (JSON-LD primary, cheerio fallback)
├── tagger.ts     Claude API for difficulty/healthiness/cuisine/meal-type
├── notion.ts     Notion page creation + database schema setup
└── config.ts     Environment variable loading with zod validation
```
