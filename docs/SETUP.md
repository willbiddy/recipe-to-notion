# Setup Guide

Complete guide for setting up and running Recipe Clipper for Notion locally.

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

## Initial Setup

### 1. Clone and install

```bash
git clone https://github.com/willbiddy/recipe-to-notion.git
cd recipe-to-notion
bun install
```

### 2. Install Python dependencies

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
2. Copy the **Internal Integration Secret** (starts with `ntn_` or `secret_`).

### 5. Create a Notion database

1. In Notion, create a new page and select **Table** → **Full page**.
2. Add the following properties to your database:
   - **"Name"** - Type: Title (this is the default property)
   - **"Source"** - Type: URL
   - **"Author"** - Type: Text
   - **"Minutes"** - Type: Number
   - **"Tags"** - Type: Multi-select
   - **"Meal type"** - Type: Select
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

### Quick Start

**Option A: Single command (quickest)**

```bash
bun run dev
# Starts both Python scraper and Bun server together
```

**Option B: Separate terminals (recommended for debugging)**

Terminal 1 — Start the Python scraper:
```bash
bun run scraper
# Runs on http://localhost:5001
```

Terminal 2 — Start the Bun server:
```bash
bun run server
# Runs on http://localhost:3000
```

**Option C: Vercel CLI (closer to production)**

First install the Vercel CLI if you haven't already:
```bash
bun add -g vercel
```

Then run:
```bash
bunx vercel dev
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

### Testing

**Test a recipe via CLI:**

```bash
bun save https://cooking.nytimes.com/recipes/1023430-pasta-with-pumpkin-seed-pesto
```

**Test the API:**

```bash
curl -X POST http://localhost:3000/api/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{"url": "https://example-recipe.com/recipe"}'
```

## What's Next?

- **[Deployment](DEPLOYMENT.md)** - Deploy to Vercel
- **[Clients](CLIENTS.md)** - Browser extension, web interface, and iOS shortcut
- **[API Reference](API.md)** - REST API documentation
