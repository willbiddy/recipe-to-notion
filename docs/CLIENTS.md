
# 🔌 Client Interfaces

Recipe Clipper for Notion provides multiple ways to save recipes: browser extension, web interface, and iOS shortcut.
## 🧩 Browser Extension

Save recipes with one click directly from Chrome/Edge.

### Quick Start

1. **Deploy to Vercel** (see [Deployment Guide](DEPLOYMENT.md))
2. **Build the extension:** `bun run build:extension`
3. **Configure** with your Vercel URL via `EXTENSION_SERVER_URL` environment variable
4. **Load in Chrome:** `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `extension/` directory

### Setup

**Build with your server URL:**

```bash
EXTENSION_SERVER_URL=https://your-app.vercel.app bun run build:extension
```

Or set it permanently:
```bash
export EXTENSION_SERVER_URL=https://your-app.vercel.app
bun run build:extension
```

> **Note:** If not set, defaults to `https://your-app.vercel.app`. For local development, defaults to `http://localhost:3000`.

**Configure API Key:**

1. Click the extension icon in your browser toolbar
2. Click the settings icon (⚙️) in the top-right corner
3. Enter your `API_SECRET` value (from your Vercel environment variables)
4. Click "Save API Key"

**Load in Chrome:**

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` directory

### Usage

1. Navigate to any recipe page in your browser
2. Click the extension icon in the toolbar
3. Click "Save Recipe"
4. The recipe will be processed and saved to your Notion database
5. A new tab will open with the saved recipe page

### Development: Local Server

For development, use a local server instead of Vercel:

1. Start the local server: `bun run server`
2. Build the extension (defaults to `http://localhost:3000`): `bun run build:extension`
3. Reload the extension in Chrome
## 🌐 Web Interface

Save recipes from your phone or any device using the web interface. Works with iOS Share Sheet (via Shortcuts) and Android Share Sheet (native).

### Quick Start

1. **Deploy to Vercel** (if not already done)
2. **Build the web interface:** `bun run build:web`
3. **Access:** Navigate to your Vercel deployment URL
4. **Configure your API key** (one-time setup)

### Setup

**Build the web interface:**

```bash
bun run build:web
```

**Configure your API key:**

1. Open the web interface in your browser
2. Click the "Settings" button at the bottom
3. Enter your `API_SECRET` value
4. Click "Save API Key"

> **Important:** The API key is stored locally in your browser's localStorage. It's never shared with anyone and is only sent to your server for authentication.

### Usage

**Manual URL Entry:**

1. Open the web interface
2. Paste a recipe URL into the input field
3. Click "Save Recipe"
4. Watch the progress updates as the recipe is processed
5. The Notion page will open automatically when complete

**URL Query Parameters:**

You can share recipe URLs via query parameters for iOS Shortcuts and other workflows:

```
https://your-app.vercel.app/?url=https://example.com/recipe
```

When a URL is provided via query parameter:
- The URL input field is automatically filled
- If your API key is configured, the recipe is automatically submitted

### Mobile Sharing

**Android Chrome (Automatic):**

Android Chrome supports the Web Share Target API natively. No setup required!

1. Navigate to a recipe page in Chrome
2. Tap the Share button
3. "Recipe Clipper for Notion" appears in your share options
4. Tap it to save the recipe

**iOS Browsers (Requires Setup):**

iOS browsers don't support Web Share Target API natively. Use iOS Shortcuts to achieve the same functionality. See the **iOS Shortcut** section below for setup.

### Features

- **Real-time Progress Updates** - Uses Server-Sent Events (SSE)
- **Auto-submit** - With query parameters and configured API key
- **Mobile-Optimized UI** - Touch-friendly buttons, responsive layout
- **Add to Home Screen** - Works on iOS and Android
## 📱 iOS Shortcut

Save recipes directly from any iOS browser's Share Sheet (Safari, Chrome, Firefox, etc.).

### Prerequisites

- iOS device with Shortcuts app installed (iOS 12+)
- Your Vercel deployment URL
- API key configured in the web interface

### Setup

**Option 1: Quick Setup (Recommended)**

Click this link on your iPhone/iPad to add the shortcut directly:

👉 **[Add Shortcut to Your Device](https://www.icloud.com/shortcuts/ce2efe6c91a7486896e1c864d9d4855b)**

After adding:
1. Open the shortcut in the Shortcuts app
2. Edit the **"Text"** action and replace the URL with your Vercel deployment URL (include `?url=` at the end)
3. Enable Share Sheet (see Step 3 below)

**Option 2: Manual Setup**

1. **Action 1: "Get URLs from Input"** - Search and add (no configuration needed)
2. **Action 2: "Text"** - Enter: `https://your-app.vercel.app/?url=` (replace with your Vercel URL)
3. **Action 3: "Combine Text"** - First input: **"Text"** variable, Second input: **"URLs"** variable
4. **Action 4: "Open URL"** - Search for `Open URLs`, select **"Combined Text"** variable, change to **"Open URL"** (singular)

**Step 3: Enable Share Sheet (CRITICAL)**

Without this, the shortcut won't appear in your Share Sheet.

1. While editing your shortcut, tap the **"Share Sheet"** tab at the bottom (or tap **"..."** → **"Share Sheet"**)
2. Toggle **"Show in Share Sheet"** to ON (green)
3. Select **"URLs"** under "Accepted Types"
4. Tap **"Done"** to save

**Step 4: Allow Untrusted Shortcuts (if needed)**

If you see a warning about untrusted shortcuts:

1. Go to **Settings** → **Shortcuts**
2. Enable **"Allow Untrusted Shortcuts"**
3. Enter your passcode if prompted

### Usage

1. Navigate to a recipe page in any browser
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Save Recipe with Recipe Clipper for Notion"**
4. The web interface opens with the recipe URL
5. If your API key is configured, the recipe is automatically processed
6. The Notion page opens when complete
## ⌨️ CLI (Command Line)

Save recipes directly from your terminal. Best for batch operations and automation.

### Usage

**Single recipe:**
```bash
bun save https://cooking.nytimes.com/recipes/1023430-pasta-with-pumpkin-seed-pesto
```

**Multiple recipes:**
```bash
bun save \
  https://www.bonappetit.com/recipe/ditalini-and-peas-in-parmesan-broth \
  https://cooking.nytimes.com/recipes/768413295-chickpeas-al-limone-with-burrata
```

**Sites that block scraping:**
```bash
bun save --html ~/Downloads/recipe.html "https://example.com/recipe"
```

### Features

- **Batch processing** — Save multiple recipes at once
- **HTML fallback** — For sites that block automated requests
- **No API key required** — Uses environment variables from `.env`
- **Fastest method** — Direct local execution, no HTTP overhead

## 🔒 Security Notes

**API Key Storage:**

- **Extension:** Stored in `chrome.storage.local` (not synced to Google servers)
- **Web Interface:** Stored in browser `localStorage` (client-side only)
- **iOS Shortcut:** Uses the web interface's storage
- **CLI:** Uses environment variables from `.env` file

All API keys are:
- Stored in plaintext locally (anyone with device access can view via DevTools)
- Only sent to your Vercel deployment for authentication
- Never shared or exposed in URLs
- All connections use HTTPS (enforced by Vercel)

Use a strong, unique `API_SECRET` and don't share it with others.
