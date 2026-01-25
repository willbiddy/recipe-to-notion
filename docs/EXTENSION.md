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

> 📖 **Full Instructions:** See [Deployment Guide](./DEPLOYMENT.md) for complete Vercel deployment steps.

**Quick Deploy:**

```bash
bunx vercel login
bunx vercel --prod
```

Then add environment variables in the Vercel dashboard:
- `ANTHROPIC_API_KEY`
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

### Step 2: Build the Extension

```bash
bun run build:extension
```

This compiles TypeScript files and Tailwind CSS for the extension UI.

### Step 3: Configure the Extension

1. Edit `extension/config.ts` and set `SERVER_URL` to your Vercel deployment URL:
   ```typescript
   export const SERVER_URL = "https://your-app.vercel.app";
   ```

2. Rebuild the extension:
   ```bash
   bun run build:extension
   ```

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

---

## Troubleshooting

### Extension Not Loading

- Make sure Developer mode is enabled in `chrome://extensions/`
- Check that you selected the `extension/` directory (not a parent directory)
- Verify the extension files were built (`bun run build:extension`)

### Connection Errors

- Verify your Vercel deployment URL is correct in `extension/config.ts`
- Check that environment variables are set in your Vercel deployment
- Test the health endpoint: `curl https://your-app.vercel.app/api/health`
- Make sure your Vercel deployment is active (check the Vercel dashboard)

### Build Errors

- Make sure all dependencies are installed: `bun install`
- Check that TypeScript compiles: `bun run typecheck`
- Verify Tailwind CSS builds: Check that `extension/styles.css` exists after building

### Recipe Processing Fails

- Check Vercel function logs in the dashboard for errors
- Verify all environment variables are set correctly
- Ensure your Notion integration has access to the database
- Check that your Anthropic API key has sufficient credits

---

## Configuration

The extension configuration is in `extension/config.ts`:

```typescript
export const SERVER_URL = "https://your-app.vercel.app";
```

**After changing the config:**

1. Rebuild the extension: `bun run build:extension`
2. Reload the extension in Chrome (click the reload icon on the extension card in `chrome://extensions/`)

---

## Development: Local Server (Optional)

For development and testing, you can use a local server instead of Vercel:

1. Start the local server: `bun run server`
2. Set `SERVER_URL` in `extension/config.ts` to `"http://localhost:3000"`
3. Rebuild and reload the extension

> **Note:** For production use, always use Vercel deployment.

---

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Deploy your server to Vercel
- [API Reference](./API.md) - Understand the API the extension uses
- [Main README](../README.md) - Project overview and other usage methods
