# Web Interface Guide

Save recipes to Notion from your phone or any device using the web interface. The web interface works alongside the Chrome extension and provides a mobile-friendly way to save recipes.

---

## Overview

The web interface is a mobile-responsive web page that allows you to:

- Save recipes from any device (phone, tablet, desktop)
- Share recipe URLs via iOS Share Sheet (with Shortcuts setup)
- Use Android Share Sheet natively (automatic, no setup)
- Access your recipe saver from anywhere with a browser

---

## Quick Start

1. **Deploy to Vercel** (if not already done - see [Deployment Guide](./DEPLOYMENT.md))
2. **Build the web interface:** `bun run build:web`
3. **Access the web page:** Navigate to your Vercel deployment URL (e.g., `https://recipe-to-notion-xi.vercel.app/`)
4. **Configure your API key** (one-time setup)

---

## Setup

### Step 1: Build the Web Interface

Before deploying, build the web interface:

```bash
bun run build:web
```

This compiles TypeScript and Tailwind CSS for the web interface.

### Step 2: Deploy to Vercel

The web interface is automatically served from the `public/` directory when deployed to Vercel. No additional configuration needed if you've already deployed the API.

### Step 3: Configure Your API Key

1. Open the web interface in your browser
2. Click the "Settings" button at the bottom
3. Enter your `API_SECRET` value (from your Vercel environment variables)
4. Click "Save API Key"

> **Important:** The API key is stored locally in your browser's localStorage. It's never shared with anyone and is only sent to your server for authentication.

---

## Usage

### Manual URL Entry

1. Open the web interface
2. Paste a recipe URL into the input field
3. Click "Save Recipe"
4. Watch the progress updates as the recipe is processed
5. The Notion page will open automatically when complete

### URL Query Parameters

You can share recipe URLs via query parameters. This enables iOS Shortcuts and other sharing workflows:

```
https://your-app.vercel.app/?url=https://example.com/recipe
```

When a URL is provided via query parameter:
- The URL input field is automatically filled
- If your API key is configured, the recipe is automatically submitted

This is useful for:
- iOS Shortcuts (see [iOS Shortcut Setup](./IOS_SHORTCUT.md))
- Browser bookmarklets
- Cross-device sharing
- Automation workflows

---

## Mobile Sharing

### Android Chrome (Automatic)

Android Chrome supports the Web Share Target API natively. No setup required!

1. Navigate to a recipe page in Chrome
2. Tap the Share button
3. "Recipe to Notion" appears in your share options
4. Tap it to save the recipe

The recipe URL is automatically sent to the web interface and processed.

### iOS Browsers (Safari, Chrome, Firefox, etc.) - Requires Setup

iOS browsers don't support Web Share Target API natively. However, you can achieve the same functionality using iOS Shortcuts, which work with **any browser** on iOS (Safari, Chrome, Firefox, Edge, etc.).

**Setup Steps:**

1. Install the iOS Shortcut (see [iOS Shortcut Setup](./IOS_SHORTCUT.md))
2. After setup, "Save Recipe to Notion" appears in your Share Sheet
3. From any browser, tap Share → "Save Recipe to Notion" → Done

The shortcut opens the web interface with the recipe URL, and if your API key is configured, it automatically processes the recipe.

> **Note:** iOS Shortcuts work with the system Share Sheet, so they work from Safari, Chrome, Firefox, Edge, and any other iOS browser that supports sharing URLs.

---

## Features

### Real-time Progress Updates

The web interface uses Server-Sent Events (SSE) to show real-time progress while processing recipes:

- "Starting..." - Initial connection
- "Scraping recipe..." - Fetching recipe data
- "Analyzing with AI..." - Claude processing
- "Saving to Notion..." - Creating Notion page
- "Complete!" - Recipe saved successfully

### Auto-submit with Query Parameters

When a URL is provided via query parameter (`?url=...`) and your API key is configured, the recipe is automatically submitted without requiring a button click.

### Mobile-Optimized UI

- Large, touch-friendly buttons and inputs
- Responsive layout that works on all screen sizes
- Optimized for portrait orientation
- Fast loading and smooth animations

### Add to Home Screen

On iOS and Android, you can add the web interface to your home screen for quick access:

**iOS:**
1. Open the web interface in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Tap "Add"

**Android:**
1. Open the web interface in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Tap "Add" or "Install"

---

## Security

### API Key Storage

- API keys are stored in browser localStorage (client-side only)
- Keys are never sent to any server except your own Vercel deployment
- Keys are never shared or exposed in URLs
- Each browser/device stores its own API key independently

### Authentication

- All API requests use Bearer token authentication
- The API key is validated server-side using constant-time comparison
- Invalid API keys are rejected immediately
- No API key means no access to your deployment

### Best Practices

- Use a strong, unique `API_SECRET` in your Vercel environment variables
- Don't share your API key with others
- If your API key is compromised, regenerate it in Vercel and update it in the web interface
- The web interface uses HTTPS (enforced by Vercel) for all connections

---

## Troubleshooting

### API Key Not Saving

- Make sure you're entering the exact value from your Vercel `API_SECRET` environment variable
- Check browser console for errors (F12 → Console)
- Try clearing browser cache and localStorage, then re-enter the key

### Connection Errors

- Verify your Vercel deployment is active (check Vercel dashboard)
- Test the health endpoint: `curl https://your-app.vercel.app/api/health`
- Check that your API key is configured correctly
- Verify the API key matches your `API_SECRET` environment variable

### Recipe Processing Fails

- Check Vercel function logs in the dashboard for errors
- Verify all environment variables are set correctly in Vercel
- Ensure your Notion integration has access to the database
- Check that your Anthropic API key has sufficient credits

### Auto-submit Not Working

- Make sure your API key is configured (check Settings)
- Verify the URL query parameter is correctly formatted: `?url=https://example.com/recipe`
- Check browser console for JavaScript errors
- Try manually submitting the URL to verify the API key works

### Android Share Sheet Not Appearing

- Make sure you've visited the web interface at least once (to register the share target)
- Clear Chrome cache and revisit the web interface
- Verify the manifest.json is being served correctly
- Check that you're using Chrome (not other browsers)

### iOS Share Sheet Not Working

- Make sure you've installed the iOS Shortcut (see [iOS Shortcut Setup](./IOS_SHORTCUT.md))
- Verify the shortcut is enabled in Settings → Shortcuts → Allow Untrusted Shortcuts
- Check that the shortcut appears in your Share Sheet (works from Safari, Chrome, Firefox, etc.)
- Try re-running the shortcut setup if it's not working
- Test from a different browser to rule out browser-specific issues

---

## Development

### Building

Build the web interface:

```bash
bun run build:web
```

This:
- Compiles TypeScript (`public/web.ts` → `public/web.js`)
- Compiles Tailwind CSS (`public/input.css` → `public/web.css`)

### Local Development

For local development:

1. Build the web interface: `bun run build:web`
2. Start the local server: `bun run server`
3. Open `http://localhost:3000/` in your browser

The web interface will use `localhost:3000` as the server URL automatically.

### File Structure

```
public/
├── index.html          # Main web page
├── manifest.json       # Web App Manifest (PWA + Share Target)
├── web.ts              # Client-side TypeScript
├── web.js              # Compiled JavaScript (generated)
├── input.css           # Tailwind CSS source
├── web.css             # Compiled CSS (generated)
└── tsconfig.json       # TypeScript configuration
```

---

## Comparison with Other Methods

| Feature | Web Interface | Chrome Extension | CLI | API |
|---------|--------------|------------------|-----|-----|
| Mobile Support | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| One-Click Save | ✅ (with setup) | ✅ Yes | ❌ No | ❌ No |
| Share Sheet | ✅ (iOS/Android) | ❌ No | ❌ No | ❌ No |
| Cross-Platform | ✅ Yes | ❌ Chrome only | ✅ Yes | ✅ Yes |
| Setup Required | Minimal | Extension install | None | None |
| Best For | Mobile users | Desktop Chrome | Automation | Integrations |

---

## Next Steps

- [iOS Shortcut Setup](./IOS_SHORTCUT.md) - Detailed instructions for iOS Share Sheet integration
- [API Reference](./API.md) - Full REST API documentation
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to Vercel
