# iOS Shortcut Setup

Set up an iOS Shortcut to save recipes directly from any browser's Share Sheet (Safari, Chrome, Firefox, etc.). After setup, "Save Recipe with Recipe Clipper for Notion" will appear in your Share Sheet whenever you're viewing a recipe page.

---

## Overview

iOS browsers (Safari, Chrome, Firefox, etc.) don't support Web Share Target API natively, but we can achieve the same functionality using iOS Shortcuts. The shortcut:

1. Receives the recipe URL from any browser's Share Sheet
2. Opens the web interface with the URL as a query parameter
3. The web interface auto-submits if your API key is configured

---

## Prerequisites

- iOS device with Shortcuts app installed (iOS 12+)
- Your Vercel deployment URL (e.g., `https://recipe-to-notion-xi.vercel.app`)
- API key configured in the web interface (see [Web Interface Guide](./WEB_INTERFACE.md))

---

## Setup Steps

### Option 1: Quick Setup (Recommended)

Click this link on your iPhone/iPad to add the shortcut directly:

👉 **[Add Shortcut to Your Device](https://www.icloud.com/shortcuts/ce2efe6c91a7486896e1c864d9d4855b)**

After adding:
1. Open the shortcut in the Shortcuts app
2. Edit the **"Text"** action and replace the URL with your Vercel deployment URL (include `?url=` at the end)
3. Follow **Step 3** below to enable Share Sheet

### Option 2: Manual Setup

1. **Action 1: "Get URLs from Input"** - Search and add (no configuration needed)
2. **Action 2: "Text"** - Enter: `https://your-app.vercel.app/?url=` (replace with your Vercel URL)
3. **Action 3: "Combine Text"** - First input: **"Text"** variable, Second input: **"URLs"** variable
4. **Action 4: "Open URL"** - Search for `Open URLs`, select **"Combined Text"** variable, change to **"Open URL"** (singular)

### Step 3: Enable Share Sheet (CRITICAL)

**Without this, the shortcut won't appear in your Share Sheet.**

1. While editing your shortcut, tap the **"Share Sheet"** tab at the bottom (or tap **"..."** → **"Share Sheet"**)
2. Toggle **"Show in Share Sheet"** to ON (green)
3. Select **"URLs"** under "Accepted Types"
4. Tap **"Done"** to save

**If it doesn't appear immediately:**
- Force close and reopen the app you're sharing from
- Restart your iPhone/iPad
- Try sharing from a different app

### Step 4: Allow Untrusted Shortcuts (if needed)

If you see a warning about untrusted shortcuts:

1. Go to **Settings** → **Shortcuts**
2. Enable **"Allow Untrusted Shortcuts"**
3. Enter your passcode if prompted

---

## Usage

After setup:

1. Navigate to a recipe page in any browser (Safari, Chrome, Firefox, etc.)
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Save Recipe with Recipe Clipper for Notion"**
4. The web interface opens with the recipe URL
5. If your API key is configured, the recipe is automatically processed
6. The Notion page opens when complete

> **Note:** This works with any iOS browser that supports the Share Sheet, including Safari, Chrome, Firefox, Edge, and others.

---

## Advanced: Multiple Shortcuts

You can create variations of the shortcut:

- **"Save Recipe"** - Quick name for frequent use
- **"Recipe Clipper for Notion"** - Alternative name
- **"Save to Notion"** - Generic name

All shortcuts can use the same actions - just change the name and icon.
