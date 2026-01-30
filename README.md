# Recipe Clipper for Notion

Save recipes to Notion without copying and pasting. Paste a URL from almost any recipe site and get a Notion page with the cover photo, ingredients grouped by shopping aisle, instructions, and AI-generated tags. Claude automatically analyzes each recipe to add cuisine tags, meal types, health scores, ingredient categories, and a short description, so you can filter and search your collection later.

## How It Works

```
CLI/Extension/Web/API → Check duplicates → Scrape recipe → Claude scores/tags → Notion page
```

1. **CLI/Extension/Web/API** — Recipe URL is provided via CLI command, browser extension click, web interface, or HTTP API request.

2. **Check duplicates** — Before processing, checks if a recipe with the same URL or title already exists in your Notion database. If found, the tool rejects the duplicate and provides a link to the existing recipe.

3. **Scrape recipe** — Sends the page HTML to the Python `recipe-scrapers` library which extracts structured recipe data. Supports 600+ recipe sites including NYT Cooking, AllRecipes, Epicurious, and many more.

4. **Claude scores/tags** — Sends the recipe to Claude, which returns tags, meal type, health score (1-10), time estimate, description, and ingredient categories grouped by shopping aisle.

5. **Notion page** — Creates a Notion page with all properties, cover image, AI description, ingredients grouped by shopping category, and numbered instructions.

## Cost

Each recipe costs about **$0.03** in Claude API usage (roughly 4,000-7,000 input tokens and 200-1,000 output tokens per recipe). The default model is Sonnet 4.5, but you can change it by setting the `CLAUDE_MODEL` environment variable to `"haiku"`, `"sonnet"`, or `"opus"`.

## Prerequisites

- **Bun**: Package manager and runtime
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Python 3.11+**: Required for recipe scraping
  ```bash
  python3 --version
  ```
- **Git**: Version control
  ```bash
  git --version
  ```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/willbiddy/recipe-to-notion.git
cd recipe-to-notion
bun install
```

### 2. Install Python dependencies (for recipe scraping)

The recipe scraper uses Python's `recipe-scrapers` library which supports 600+ recipe websites.

```bash
# Using pip directly
pip install -r requirements-dev.txt

# Or with a virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate  # macOS/Linux
pip install -r requirements-dev.txt
```

### 3. Create an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com/) and sign in or create an account.
2. Navigate to **API Keys** in the sidebar.
3. Click **Create Key** and give it a name (e.g., "Recipe Clipper for Notion").
4. Copy the API key (starts with `sk-ant-`). You won't be able to see it again, so save it securely.

### 4. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration.
2. Copy the **Internal Integration Secret** (starts with `ntn_`).

### 5. Create a Notion database

1. In Notion, create a new page and select **Table** → **Full page**.
2. Add the following properties to your database:
   - **"Name"** - Type: Title (this is the default property)
   - **"Source"** - Type: URL
   - **"Author"** - Type: Text
   - **"Minutes"** - Type: Number
   - **"Tags"** - Type: Multi-select
   - **"Meal type"** - Type: Multi-select
   - **"Health score"** - Type: Number
3. Connect your integration to the database:
   - Click the `...` menu in the top-right of the database
   - Select **Connections**
   - Choose your integration from the list

### 6. Get your database ID

The database ID is the 32-character hex string in your database URL (`https://www.notion.so/yourworkspace/DATABASE_ID_HERE?v=...`). Copy just the ID portion (with or without dashes).

### 7. Configure environment variables

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

## Local Development

To run the project locally, you need to start both the Python recipe scraper and the Bun server.

### Option A: Single command (quickest)

```bash
bun run dev
# Starts both Python scraper and Bun server together
```

### Option B: Separate terminals (recommended for debugging)

**Terminal 1** — Start the Python scraper:
```bash
bun run scraper
# Runs on http://localhost:5001
```

**Terminal 2** — Start the Bun server:
```bash
bun run server
# Runs on http://localhost:3000
```

### Option C: Vercel CLI (closer to production)

```bash
vercel dev
# Runs both TypeScript and Python functions together
# Runs on http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key (starts with `sk-ant-`) |
| `NOTION_API_KEY` | Yes | Notion integration token (starts with `ntn_` or `secret_`) |
| `NOTION_DATABASE_ID` | Yes | Target Notion database ID |
| `API_SECRET` | Yes | Secret for API authentication |
| `PYTHON_SCRAPER_URL` | No | Override Python scraper URL (default: `http://localhost:5001/scrape` in dev) |

## Deployment

When you push to your connected Git repository, **Vercel automatically redeploys** both the TypeScript and Python functions. No manual steps required.

The Python scraper runs as a Vercel serverless function at `/api/scrape` — the TypeScript backend automatically detects the Vercel environment and calls it at the correct URL.

### Vercel Deployment Protection Setup

If you have Vercel Deployment Protection enabled, you need to create a **Protection Bypass for Automation** secret to allow your TypeScript backend to call the Python scraper:

1. Go to your Vercel project settings → **Deployment Protection**
2. Scroll to **"Protection Bypass for Automation"**
3. Click **"Add a secret"** — Vercel will generate a bypass secret automatically
4. The secret is automatically available as `VERCEL_AUTOMATION_BYPASS_SECRET` (no manual configuration needed)
5. Redeploy your project — the backend will automatically use this secret to bypass protection when calling the scraper

> 💡 **Why this is needed:** Vercel's Deployment Protection blocks external requests, including internal function-to-function calls. The bypass secret allows your TypeScript functions to call the Python scraper while keeping your deployment protected from unauthorized access.

> 📖 See [Deployment Guide](docs/DEPLOYMENT.md) for initial Vercel setup and environment variable configuration.

## Documentation

📚 **Detailed Guides:**
- **[Browser Extension Setup](docs/EXTENSION.md)** - Complete guide for setting up and using the browser extension
- **[Web Interface Guide](docs/WEB_INTERFACE.md)** - Mobile-friendly web interface for saving recipes from any device
- **[iOS Shortcut Setup](docs/IOS_SHORTCUT.md)** - Set up iOS Share Sheet integration
- **[API Reference](docs/API.md)** - Full REST API documentation with examples
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to Vercel
- **[Development Reference](docs/reference.md)** - Code style, naming conventions, and patterns

---

## Development

### Debugging

**Extension:**
```typescript
// Add to popup/background/content script
console.log("[Extension]", data);

// View logs in:
// - Popup: Right-click popup → Inspect
// - Background: chrome://extensions → Inspect service worker
// - Content: Page DevTools → Console
```

**Web Interface:**
```typescript
// Standard browser DevTools
console.log("[Web]", data);
```

**Backend:**
```typescript
// Server logs
console.log("[Server]", data);
// View in terminal running `bun run server`
```

### Security Considerations

- **Input Validation**: Validate all external inputs (URLs, API requests)
- **SSRF Prevention**: URLs are validated before fetching (only http/https allowed)
- **No Stack Traces**: Server errors never expose stack traces to clients
- **Secrets**: Never log or commit API keys (use `.env` file)
- **Rate Limiting**: 10 requests per minute per API key/IP
- **XSS Prevention**: HTML content is never rendered via `innerHTML`

### Code Quality

Run all checks before committing:

```bash
bun run check    # TypeScript + lint + format
```

---

## Usage

There are four ways to use Recipe Clipper for Notion:

### 1. Command Line Interface (CLI)

The simplest way to get started. Save recipes from the terminal:

```bash
# Single recipe
bun save https://cooking.nytimes.com/recipes/1023430-pasta-with-pumpkin-seed-pesto

# Multiple recipes
bun save \
  https://www.bonappetit.com/recipe/ditalini-and-peas-in-parmesan-broth \
  https://cooking.nytimes.com/recipes/768413295-chickpeas-al-limone-with-burrata \
  https://www.seriouseats.com/tacos-gobernador-sinaloan-shrimp-tacos-recipe-8676611

# If a site blocks requests (403 error), save the page source and use --html
bun save --html ~/Downloads/baked-oatmeal-recipe.html "https://cookieandkate.com/baked-oatmeal-recipe/"
```

### 2. Browser Extension

Save recipes with one click directly from your browser.

> 📖 See [Extension Setup Guide](docs/EXTENSION.md) for complete setup instructions.
>
> **Quick Start:** Deploy to Vercel (see [Deployment Guide](docs/DEPLOYMENT.md)), then build and load the extension.

### 3. Web Interface

Save recipes from your phone or any device using the web interface. Works with iOS Share Sheet (via Shortcuts) and Android Share Sheet (native).

> 📖 See [Web Interface Guide](docs/WEB_INTERFACE.md) for complete setup instructions, including iOS and Android sharing.
>
> **Quick Start:** Deploy to Vercel, build the web interface (`bun run build:web`), then access it at your Vercel URL.

### 4. HTTP API

Use the REST API to integrate Recipe Clipper for Notion into your own applications or scripts.

> 📖 **Full API Docs:** See [API Reference](docs/API.md) for complete endpoint documentation, request/response formats, and examples.

---

**Technologies:**

- [Anthropic SDK](https://docs.anthropic.com/en/api/client-sdks) - Claude AI API client
- [Notion SDK](https://github.com/makenotion/notion-sdk-js) - Notion API client
- [recipe-scrapers](https://github.com/hhursev/recipe-scrapers) - Recipe extraction
- [Bun](https://bun.sh/) - JavaScript runtime
- [Solid.js](https://www.solidjs.com/) - Reactive UI framework
- [Zod](https://zod.dev/) - Schema validation
- [Vercel](https://vercel.com/) - Serverless hosting
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Citty](https://github.com/unjs/citty) - CLI argument parsing
- [Biome](https://biomejs.dev/) - Linting & formatting

---

## Scripts

### Development Scripts

- **`bun run save`** - Run the CLI tool to save recipes from the command line
- **`bun run dev`** - Start both Python scraper and Bun server together
- **`bun run scraper`** - Start the Python recipe scraper (runs on `localhost:5001`)
- **`bun run server`** - Start the Bun HTTP server (runs on `localhost:3000`)

### Build Scripts

- **`bun run build`** - Compile the CLI tool to a standalone binary (`recipe-to-notion`)
- **`bun run build:extension`** - Compile TypeScript and Tailwind CSS for the browser extension
- **`bun run build:web`** - Compile TypeScript and Tailwind CSS for the web interface

### Watch Scripts (Auto-rebuild on file changes)

- **`bun run watch`** - Watch all files (extension and web) and rebuild automatically on changes
- **`bun run watch:extension`** - Watch extension files only and rebuild on changes
- **`bun run watch:web`** - Watch web files only and rebuild on changes

### Code Quality Scripts

- **`bun run check`** - Run all code quality checks (typecheck, lint:fix, and format) - same as pre-commit hook
- **`bun run typecheck`** - Check TypeScript types for errors
- **`bun run lint`** - Run linter to find code issues
- **`bun run lint:fix`** - Run linter and automatically fix issues
- **`bun run format`** - Auto-format code with Biome

---

## Credits

Icon attribution: <a href="https://www.flaticon.com/free-icons/cutlery" title="cutlery icons">Cutlery icons created by Freepik - Flaticon</a>

