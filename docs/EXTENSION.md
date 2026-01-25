# Browser Extension Setup

Save recipes with one click directly from your browser! The extension works with either a local server or a cloud-deployed server (Vercel).

---

## Quick Start

1. **Build the extension:** `bun run build:extension`
2. **Choose server option** (see options below)
3. **Load in Chrome:** `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `extension/` directory

---

## Server Options

### Option A: Local Server

Perfect for development and testing.

#### Step 1: Build the Extension

```bash
bun run build:extension
```

This compiles TypeScript files and Tailwind CSS for the extension UI.

#### Step 2: Start the Local Server

```bash
bun run server
```

The server runs on `http://localhost:3000` by default (configurable via `SERVER_PORT` env var).

#### Step 3: Configure the Extension

1. Edit `extension/config.ts` and set `SERVER_URL` to `"http://localhost:3000"`
2. Rebuild: `bun run build:extension`
3. Reload the extension in Chrome

#### Step 4: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` directory

---

### Option B: Vercel Deployment (Recommended)

Deploy the server to Vercel so you don't need to run a local server.

> 📖 **Full Deployment Guide:** See [Deployment Guide](./DEPLOYMENT.md#vercel) for detailed Vercel instructions.

#### Step 1: Build the Extension

```bash
bun run build:extension
```

#### Step 2: Deploy to Vercel

```bash
bunx vercel login
bunx vercel --prod
```

Add environment variables in Vercel dashboard (Settings → Environment Variables):
- `ANTHROPIC_API_KEY`
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

#### Step 3: Configure the Extension

1. Edit `extension/config.ts` and set `SERVER_URL` to your Vercel deployment URL (e.g., `"https://recipe-to-notion-xi.vercel.app"`)
2. Rebuild: `bun run build:extension`
3. Reload the extension in Chrome

#### Step 4: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` directory

---

### Option C: Other Platforms

The server can also be deployed to Railway, Fly.io, Render, DigitalOcean, or any VPS.

> 📖 **Platform Guides:** See [Deployment Guide](./DEPLOYMENT.md) for platform-specific instructions.

**Quick Steps:**

1. Deploy `cli-server.ts` to your platform (defaults to port 3000, configurable via `SERVER_PORT`)
2. Set `SERVER_URL` in `extension/config.ts` to your deployment URL
3. Rebuild and load the extension

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

**For local server:**
- Ensure `bun run server` is running
- Verify `SERVER_URL` in `extension/config.ts` matches your server URL

**For Vercel/cloud deployment:**
- Verify your deployment URL is correct in `extension/config.ts`
- Check that environment variables are set in your deployment
- Test the health endpoint: `curl https://your-deployment.com/api/health`

### Build Errors

- Make sure all dependencies are installed: `bun install`
- Check that TypeScript compiles: `bun run typecheck`
- Verify Tailwind CSS builds: Check that `extension/styles.css` exists after building

---

## Configuration

The extension configuration is in `extension/config.ts`:

```typescript
export const SERVER_URL = "http://localhost:3000"; // or your Vercel URL
```

**After changing the config:**

1. Rebuild the extension: `bun run build:extension`
2. Reload the extension in Chrome (click the reload icon on the extension card in `chrome://extensions/`)

---

## Related Documentation

- [API Reference](./API.md) - Understand the API the extension uses
- [Deployment Guide](./DEPLOYMENT.md) - Deploy your server to various platforms
- [Main README](../README.md) - Project overview and other usage methods
