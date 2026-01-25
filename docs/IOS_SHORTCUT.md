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
4. Search for **"Get URLs from Input"** and add it (this receives the URL from Share Sheet)
5. Tap **"Add Action"** again
6. Search for **"Text"** and add it
7. In the Text action, enter:
    ```
    https://your-app.vercel.app/?url=
    ```
    Replace `your-app.vercel.app` with your actual Vercel deployment URL (e.g., `recipe-to-notion-xi.vercel.app`)
8. Tap **"Add Action"** again
9. Search for **"Combine Text"** and add it
10. In the Combine Text action:
    - First input: Tap and select the **Text** variable (from step 6)
    - Second input: Tap and select the **URLs** variable (from step 4 - the "Get URLs from Input" result)
11. Tap **"Add Action"** again
12. Search for **"Open URLs"** and add it
13. In the "Open URLs" action, tap the input field and select the **Combined Text** variable (from step 9)
14. Tap **"Show More"** on the Open URLs action
15. Change **"Open URLs"** to **"Open URL"** (singular)

### Step 2: Configure the Shortcut

1. Tap the **"..."** button (three dots) in the top-right of the shortcut editor
2. In the **"Details"** screen:
   - Set the shortcut name to: **"Save Recipe to Notion"**
   - (Optional) Choose an icon and color
   - (Optional) Tap **"Add to Home Screen"** if you want a home screen shortcut
3. **IMPORTANT:** Before tapping "Done", make sure you complete Step 3 (Share Sheet) below
4. Tap **"Done"** to save the shortcut

### Step 3: Enable Share Sheet (CRITICAL - This makes it appear!)

**This is the most important step! Without this, the shortcut won't appear in your Share Sheet.**

**Method 1: From the shortcut editor**
1. While editing your shortcut, look at the **bottom of the screen**
2. You should see tabs like: **"Details"**, **"Share Sheet"**, **"Automation"**, etc.
3. Tap the **"Share Sheet"** tab
4. Toggle the switch **"Show in Share Sheet"** to ON (it should turn green)
5. Under **"Accepted Types"**, tap to select **"URLs"** (should show a checkmark)
6. Tap **"Done"** in the top-right to save

**Method 2: From shortcut details (if you don't see the tab)**
1. Tap the **"..."** button (three dots) in the top-right of the shortcut editor
2. Scroll down or look for **"Share Sheet"** option
3. Tap **"Share Sheet"**
4. Toggle **"Show in Share Sheet"** to ON (green)
5. Select **"URLs"** under "Accepted Types"
6. Tap **"Done"** to save

**After enabling:**
- The shortcut should now appear in Share Sheets when you share a URL
- If it doesn't appear immediately, try:
  - Force closing the app you're sharing from (Safari, Chrome, etc.)
  - Restarting your iPhone/iPad
  - Sharing from a different app to test

### Step 4: Allow Untrusted Shortcuts (if needed)

If you see a warning about untrusted shortcuts:

1. Go to **Settings** → **Shortcuts**
2. Enable **"Allow Untrusted Shortcuts"**
3. Enter your passcode if prompted

---

## Alternative: Simpler Method (If the above doesn't work)

If you're having trouble with the variable passing, try this simpler approach:

**Shortcut Name:** Save Recipe to Notion

**Actions:**
1. **Get URLs from Input** (receives URL from Share Sheet)
2. **URL** action → Enter: `https://your-app.vercel.app/?url=`
   - Then tap the "+" next to the URL field and select the **URLs** variable from step 1
3. **Open URLs** → Tap the input and select the **URL** variable from step 2
   - Change to "Open URL" (singular) in Show More

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

**Most Common Issues:**

1. **Share Sheet not enabled:**
   - Open the shortcut in the Shortcuts app
   - Tap the **"..."** button (three dots) in the top-right
   - Tap **"Share Sheet"** tab at the bottom
   - Make sure **"Show in Share Sheet"** is ON (green toggle)
   - Verify **"URLs"** is checked under "Accepted Types"

2. **Shortcut not saved:**
   - Make sure you tapped "Done" after configuring the Share Sheet settings
   - The shortcut should appear in your Shortcuts library

3. **Try these steps:**
   - Force close and reopen the app you're sharing from (Safari, Chrome, etc.)
   - Restart your iPhone/iPad
   - Check Settings → Shortcuts → make sure the shortcut isn't disabled
   - Try sharing from a different app to see if it appears

4. **Still not working?**
   - Delete the shortcut and recreate it, making sure to enable Share Sheet before saving
   - Check that you're on iOS 12 or later (required for Share Sheet shortcuts)

### Shortcut Opens but Recipe Doesn't Process

- Verify your API key is configured in the web interface
- Check that the URL query parameter is correct: `?url=https://example.com/recipe`
- Open the web interface manually and test saving a recipe
- Check browser console for errors (if using Safari/Chrome on Mac)
- Try from a different browser to rule out browser-specific issues

### URL Not Being Passed Correctly / "Make sure to pass a valid URL" Error

This error means the URL variable isn't being passed to the "Open URL" action correctly.

**Fix:**
1. Make sure "Get URLs from Input" is the **first action**
2. When building the final URL, you need to:
   - Use a **Text** action with your base URL: `https://your-app.vercel.app/?url=`
   - Use **Combine Text** to join the base URL with the URL from "Get URLs from Input"
   - OR use the **URL** action and tap the "+" to add the variable
3. Make sure the "Open URL" action receives the **combined/final URL**, not just the base URL
4. Test by running the shortcut manually (tap it in Shortcuts app) - it should open a URL with `?url=something`

**Quick Fix:**
- Delete the shortcut and recreate it following Step 1 above exactly
- Make sure you're selecting the **URLs** variable (from "Get URLs from Input") when building the final URL

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
