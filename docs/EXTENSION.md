# Browser Extension Setup

Save recipes with one click directly from your browser! The extension connects to your Vercel-deployed server.

---

## Quick Start

1. **Deploy to Vercel** (see [Deployment Guide](./DEPLOYMENT.md))
2. **Build the extension:** `bun run build:extension`
3. **Configure the extension** with your Vercel URL
4. **Load in Chrome:** `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `extension/` directory

---

## Setup Steps

### Step 1: Deploy to Vercel

First, deploy your server to Vercel. This is a one-time setup.

> 📖 **Full Instructions:** See [Deployment Guide](./DEPLOYMENT.md) for complete Vercel deployment steps, including environment variable configuration.

### Step 2: Build the Extension

```bash
bun run build:extension
```

This bundles Solid.js components and compiles Tailwind CSS for the extension UI.

### Step 3: Configure the Extension

1. Set the server URL via environment variable when building:
   ```bash
   EXTENSION_SERVER_URL=https://your-app.vercel.app bun run build:extension
   ```

   Or set it permanently in your shell:
   ```bash
   export EXTENSION_SERVER_URL=https://your-app.vercel.app
   bun run build:extension
   ```

   > **Note:** If `EXTENSION_SERVER_URL` is not set, it defaults to `https://recipe-to-notion-xi.vercel.app`. For local development, it defaults to `http://localhost:3000`.

2. Load the extension in Chrome (see Step 4)

4. **Configure API Key:**
   - Click the extension icon in your browser toolbar
   - Click the settings icon (⚙️) in the top-right corner
   - Enter your `API_SECRET` value (from your Vercel environment variables)
   - Click "Save API Key"

   > **Important:** The API key is required for authentication. Without it, the extension cannot save recipes.

### Step 4: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` directory

---

## Usage

1. Navigate to any recipe page in your browser
2. Click the extension icon in the toolbar
3. Click "Save Recipe"
4. The recipe will be processed and saved to your Notion database
5. A new tab will open with the saved recipe page

---

## Features

- **Real-time Progress Updates** - The extension uses Server-Sent Events (SSE) to show progress while processing recipes
- **Error Handling** - Clear error messages for duplicates, connection issues, and other problems
- **Auto-open** - Automatically opens the saved Notion page after successful save

## Configuration

### Server URL

The extension server URL is configured at build time via the `EXTENSION_SERVER_URL` environment variable:

```bash
EXTENSION_SERVER_URL=https://your-app.vercel.app bun run build:extension
```

**After changing the server URL:**

1. Rebuild the extension with the new URL: `EXTENSION_SERVER_URL=https://new-url.vercel.app bun run build:extension`
2. Reload the extension in Chrome (click the reload icon on the extension card in `chrome://extensions/`)

### API Key

The API key is stored locally in the browser's storage (not synced to Google servers) and can be configured through the extension popup:

1. Click the extension icon
2. Click the settings icon (⚙️) in the top-right
3. Enter your `API_SECRET` value
4. Click "Save API Key"

The API key is required for all API requests and prevents unauthorized usage of your deployment.

> **Security Note:** The API key is stored in `chrome.storage.local` (not `sync`) to avoid syncing sensitive data to Google servers. However, it is stored in plaintext on your local machine. Anyone with access to your Chrome profile can view it. For maximum security, use a strong, unique `API_SECRET` and don't share your Chrome profile.

---

## Development: Local Server (Optional)

For development and testing, you can use a local server instead of Vercel:

1. Start the local server: `bun run server`
2. Build the extension without setting `EXTENSION_SERVER_URL` (it defaults to `http://localhost:3000`):
   ```bash
   bun run build:extension
   ```
3. Reload the extension in Chrome

> **Note:** For production use, always use Vercel deployment and set `EXTENSION_SERVER_URL` to your production URL.

