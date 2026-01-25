# iOS Shortcut Setup

Set up an iOS Shortcut to save recipes directly from any browser's Share Sheet (Safari, Chrome, Firefox, etc.). After setup, "Save Recipe to Notion" will appear in your Share Sheet whenever you're viewing a recipe page.

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

### Step 1: Create the Shortcut

1. Open the **Shortcuts** app on your iPhone/iPad
2. Tap the **"+"** button in the top-right to create a new shortcut
3. Tap **"Add Action"**
4. Search for **"Get URLs from Input"** and add it
5. Tap **"Add Action"** again
6. Search for **"Open URLs"** and add it
7. Tap on the **"Open URLs"** action
8. Tap **"Show More"**
9. Change **"Open URLs"** to **"Open URL"** (singular)
10. In the URL field, enter your web interface URL with a placeholder:
    ```
    https://your-app.vercel.app/?url=[URL]
    ```
    Replace `your-app.vercel.app` with your actual Vercel deployment URL.
    
    **Important:** Use `[URL]` as a placeholder - Shortcuts will replace it with the shared URL.

### Step 2: Configure the Shortcut

1. Tap the **"..."** button in the top-right of the shortcut editor
2. Set the shortcut name to: **"Save Recipe to Notion"**
3. (Optional) Choose an icon and color
4. Tap **"Add to Home Screen"** if you want a home screen shortcut
5. Tap **"Done"**

### Step 3: Enable Share Sheet

1. In the shortcut editor, tap **"Share Sheet"** at the bottom
2. Enable **"Show in Share Sheet"**
3. Under **"Accepted Types"**, select **"URLs"**
4. Tap **"Done"**

### Step 4: Allow Untrusted Shortcuts (if needed)

If you see a warning about untrusted shortcuts:

1. Go to **Settings** → **Shortcuts**
2. Enable **"Allow Untrusted Shortcuts"**
3. Enter your passcode if prompted

---

## Alternative: Import Pre-Made Shortcut

If you prefer, you can create a shortcut using this recipe structure:

**Shortcut Name:** Save Recipe to Notion

**Actions:**
1. **Get URLs from Input** (receives URL from Share Sheet)
2. **Get Variable** → Select the URL from step 1
3. **URL** → `https://your-app.vercel.app/?url=[Variable]`
4. **Open URLs** → Open the URL from step 3

**Share Sheet Settings:**
- Show in Share Sheet: ✅ Enabled
- Accepted Types: URLs

---

## Usage

After setup:

1. Navigate to a recipe page in any browser (Safari, Chrome, Firefox, etc.)
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Save Recipe to Notion"**
4. The web interface opens with the recipe URL
5. If your API key is configured, the recipe is automatically processed
6. The Notion page opens when complete

> **Note:** This works with any iOS browser that supports the Share Sheet, including Safari, Chrome, Firefox, Edge, and others.

---

## Troubleshooting

### Shortcut Not Appearing in Share Sheet

- Make sure "Show in Share Sheet" is enabled in the shortcut settings
- Verify "Accepted Types" includes "URLs"
- Try restarting your device
- Check that the shortcut is not disabled in Settings → Shortcuts

### Shortcut Opens but Recipe Doesn't Process

- Verify your API key is configured in the web interface
- Check that the URL query parameter is correct: `?url=https://example.com/recipe`
- Open the web interface manually and test saving a recipe
- Check browser console for errors (if using Safari/Chrome on Mac)
- Try from a different browser to rule out browser-specific issues

### URL Not Being Passed Correctly

- Verify the shortcut uses "Get URLs from Input" as the first action
- Check that the URL in the "Open URL" action uses `[URL]` or the variable from step 1
- Test the shortcut by running it manually (tap the shortcut in the Shortcuts app)

### "Allow Untrusted Shortcuts" Not Available

- This option only appears if you've created at least one shortcut manually
- Create a simple test shortcut first, then the option will appear
- On iOS 15+, you may need to enable it in Settings → Shortcuts → Advanced

### Shortcut Opens Wrong URL

- Verify your Vercel deployment URL is correct
- Check that the URL format is: `https://your-app.vercel.app/?url=[URL]`
- Make sure you're using `[URL]` (with brackets) as the placeholder
- Test by manually opening: `https://your-app.vercel.app/?url=https://example.com/recipe`

---

## Advanced: Multiple Shortcuts

You can create variations of the shortcut:

- **"Save Recipe"** - Quick name for frequent use
- **"Recipe to Notion"** - Alternative name
- **"Save to Notion"** - Generic name

All shortcuts can use the same actions - just change the name and icon.

---

## Security Notes

- The shortcut only opens your web interface - it doesn't store or share your API key
- Your API key is stored securely in the web interface (localStorage)
- The shortcut URL is only used to pass the recipe URL to the web interface
- No data is sent to third-party services

---

## Next Steps

- [Web Interface Guide](./WEB_INTERFACE.md) - Complete web interface documentation
- [API Reference](./API.md) - REST API documentation
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to Vercel
