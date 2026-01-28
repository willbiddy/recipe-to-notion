# Deployment Guide

Deploy the Recipe Clipper for Notion server to Vercel. The code is already configured for Vercel deployment.

---

## Quick Deploy

### Step 1: Login to Vercel

```bash
bunx vercel login
```

### Step 2: Deploy

```bash
bunx vercel --prod
```

### Step 3: Add Environment Variables

1. Go to your project settings on [vercel.com](https://vercel.com)
2. Navigate to **Settings → Environment Variables**
3. Add the following variables:
   - `ANTHROPIC_API_KEY` - Your Anthropic API key (starts with `sk-ant-`)
   - `NOTION_API_KEY` - Your Notion integration secret (starts with `ntn_`)
   - `NOTION_DATABASE_ID` - Your Notion database ID (32-character hex string)
   - `API_SECRET` - A secret key for API authentication (use a strong, random value - you'll need this to configure the browser extension)
4. Select all environments (Production, Preview, Development)
5. Redeploy after adding variables (or wait for auto-deploy)

> **Security Note:** The `API_SECRET` prevents unauthorized access to your API. Use a strong, random value (e.g., generate with `openssl rand -hex 32`). You'll need to configure this in the browser extension.

### Step 4: Configure Deployment Protection (If Enabled)

If you have Vercel Deployment Protection enabled (requires authentication to access your deployments):

1. Go to your project settings → **Deployment Protection**
2. Scroll to **"Protection Bypass for Automation"**
3. Click **"Add a secret"** — Vercel will generate a bypass secret automatically
4. The secret is automatically available as `VERCEL_AUTOMATION_BYPASS_SECRET` (no manual configuration needed)
5. Redeploy your project

> **Why this is needed:** Deployment Protection blocks all requests, including internal function-to-function calls. The bypass secret allows your TypeScript backend to call the Python scraper while keeping your deployment protected from unauthorized access.

> **Note:** If you don't have Deployment Protection enabled, you can skip this step.

### Step 5: Get Your Deployment URL

- Vercel will provide a URL like `https://recipe-to-notion-xi.vercel.app`
- Copy this URL - you'll need it to configure the browser extension

---

## Testing Your Deployment

> 📖 **API Endpoints:** See [API Reference](./API.md) for complete endpoint documentation, including the health check endpoint.

### Test Recipe Processing

```bash
curl -X POST https://your-app.vercel.app/api/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{"url": "https://cooking.nytimes.com/recipes/1234-example"}'
```

Replace `YOUR_API_SECRET` with the value you set for the `API_SECRET` environment variable.

---

## Important Notes

### Execution Time Limit

- Vercel's free tier has a **60-second execution limit** per function call
- Recipe processing typically takes 30-45 seconds, so this is sufficient for most recipes
- For longer processing times, consider upgrading to a paid plan

### Environment Variables

All four environment variables are required:
- `ANTHROPIC_API_KEY` - Used for Claude API calls
- `NOTION_API_KEY` - Used for Notion API calls
- `NOTION_DATABASE_ID` - Target Notion database
- `API_SECRET` - Secret key for API authentication (prevents unauthorized usage)

Make sure to add these in the Vercel dashboard before testing.

### Automatic Deployments

Vercel automatically deploys on every push to your connected Git repository. After adding environment variables, you may need to trigger a redeploy or wait for the next automatic deployment.

---

## Troubleshooting

### Deployment Fails

- Check that all required files are committed to Git
- Verify `vercel.json` exists in the root directory
- Check Vercel build logs for errors

### Function Timeout

- Recipe processing is taking longer than 60 seconds
- Check Vercel function logs for errors
- Consider upgrading to a paid plan for longer execution times

### Environment Variables Not Working

- Make sure variables are added to the correct environment (Production, Preview, Development)
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### API Errors

- Verify all environment variables are set correctly
- Check Vercel function logs for detailed error messages
- Ensure your Notion integration has access to the database
- Verify your Anthropic API key has sufficient credits

### Python Scraper Authentication Error

If you see errors like "Authentication Required" or 401 errors when scraping recipes:

- This means Vercel Deployment Protection is blocking the Python scraper
- Go to **Project Settings → Deployment Protection**
- Create a **Protection Bypass for Automation** secret
- Redeploy your project (or wait for automatic deployment)
- The backend will automatically use `VERCEL_AUTOMATION_BYPASS_SECRET` to bypass protection

---

## Next Steps

After deploying to Vercel:

1. **Configure the browser extension** - See [Extension Setup Guide](./EXTENSION.md)
2. **Test the API** - Use the health check and test recipe endpoints
3. **Monitor usage** - Check Vercel dashboard for function invocations and execution times

---

## Scripts

### Build Scripts

- **`bun run build`** - Compile the CLI tool to a standalone binary
- **`bun run build:extension`** - Build the browser extension
- **`bun run build:web`** - Build the web interface

### Watch Scripts (Auto-rebuild on file changes)

- **`bun run watch`** - Watch all files and rebuild automatically on changes
- **`bun run watch:extension`** - Watch extension files only
- **`bun run watch:web`** - Watch web files only

### Development Scripts

- **`bun run server`** - Start local HTTP server for development
- **`bun run check`** - Run all code quality checks (typecheck, lint:fix, and format)
- **`bun run typecheck`** - Check TypeScript types for errors
- **`bun run lint`** - Run linter to find code issues
- **`bun run lint:fix`** - Run linter and automatically fix issues
- **`bun run format`** - Auto-format code with Biome

For a complete list of all available scripts, see the [main README](../README.md#scripts).

