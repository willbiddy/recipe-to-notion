# Deployment Guide

Deploy the recipe-to-notion server to Vercel. The code is already configured for Vercel deployment.

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
4. Select all environments (Production, Preview, Development)
5. Redeploy after adding variables (or wait for auto-deploy)

### Step 4: Get Your Deployment URL

- Vercel will provide a URL like `https://recipe-to-notion-xi.vercel.app`
- Copy this URL - you'll need it to configure the browser extension

---

## Testing Your Deployment

### Health Check

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "recipe-to-notion"
}
```

### Test Recipe Processing

```bash
curl -X POST https://your-app.vercel.app/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"url": "https://cooking.nytimes.com/recipes/1234-example"}'
```

---

## Important Notes

### Execution Time Limit

- Vercel's free tier has a **60-second execution limit** per function call
- Recipe processing typically takes 30-45 seconds, so this is sufficient for most recipes
- For longer processing times, consider upgrading to a paid plan

### Environment Variables

All three environment variables are required:
- `ANTHROPIC_API_KEY` - Used for Claude API calls
- `NOTION_API_KEY` - Used for Notion API calls
- `NOTION_DATABASE_ID` - Target Notion database

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

---

## Next Steps

After deploying to Vercel:

1. **Configure the browser extension** - See [Extension Setup Guide](./EXTENSION.md)
2. **Test the API** - Use the health check and test recipe endpoints
3. **Monitor usage** - Check Vercel dashboard for function invocations and execution times

---

## Related Documentation

- [Extension Setup](./EXTENSION.md) - Configure the browser extension to use your Vercel deployment
- [API Reference](./API.md) - Understand the API endpoints
- [Main README](../README.md) - Project overview
