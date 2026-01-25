# API Reference

The recipe-to-notion server provides a REST API for processing recipes. Deploy to Vercel to use the API.

---

## Base URL

- **Vercel:** `https://your-app.vercel.app`

---

## Endpoints

### POST /api/recipes

Process and save a recipe to Notion.

#### Request

```bash
curl -X POST https://your-server.com/api/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{"url": "https://cooking.nytimes.com/recipes/1234-example"}'
```

#### Request Body

```typescript
{
  url: string;        // Required: Recipe page URL
  stream?: boolean;   // Optional: Use Server-Sent Events for progress updates
}
```

#### Response (Non-streaming)

```json
{
  "success": true,
  "pageId": "abc123...",
  "notionUrl": "https://www.notion.so/abc123..."
}
```

#### Response (Streaming)

When `stream: true`, returns Server-Sent Events (SSE) with the following event types:

**Progress Event:**
```json
{
  "type": "progress",
  "message": "Scraping recipe...",
  "progressType": "scraping"
}
```

**Complete Event:**
```json
{
  "type": "complete",
  "success": true,
  "pageId": "abc123...",
  "notionUrl": "https://www.notion.so/abc123..."
}
```

**Error Event:**
```json
{
  "type": "error",
  "success": false,
  "error": "Duplicate recipe found...",
  "notionUrl": "https://www.notion.so/abc123..." // If duplicate
}
```

#### Error Responses

- **400 Bad Request** - Missing or invalid URL
- **409 Conflict** - Duplicate recipe found
- **500 Internal Server Error** - Processing error

#### Example with Streaming

```bash
curl -X POST https://your-server.com/api/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{"url": "https://example.com/recipe", "stream": true}'
```

---

### GET /api/health

Health check endpoint to verify the server is running.

#### Request

```bash
curl https://your-server.com/api/health
```

#### Response

```json
{
  "status": "ok",
  "service": "recipe-to-notion"
}
```

---

## CORS

The API includes CORS headers to allow cross-origin requests from browser extensions and web applications.

- **Allowed Methods:** `GET`, `POST`, `OPTIONS`
- **Allowed Headers:** `Content-Type`, `Authorization`
- **Allowed Origins:** `*` (all origins)

> **Security Note:** CORS is set to allow all origins (`*`) to support browser extensions, which can make requests from any origin. The API is protected by API key authentication, which provides the primary security layer. In production, consider restricting CORS to specific origins if you only need to support specific web applications (browser extensions will still work regardless of CORS settings).

---

## Error Handling

All errors return JSON responses with appropriate HTTP status codes:

```json
{
  "success": false,
  "error": "Error message here",
  "notionUrl": "https://www.notion.so/..." // If duplicate found
}
```

---

## Rate Limiting

Currently, there is no rate limiting implemented at the application level. Be mindful of API usage costs (Claude API) when making requests.

> **Note:** Vercel's serverless functions have built-in rate limiting based on your plan. For additional protection, consider implementing application-level rate limiting or using Vercel's Edge Middleware for rate limiting.

---

## Authentication

**The API requires authentication via API key to prevent unauthorized usage.**

All requests must include an `Authorization` header with a Bearer token:

```
Authorization: Bearer YOUR_API_SECRET
```

The `API_SECRET` is set as an environment variable in your Vercel deployment. This prevents others from using your API and incurring costs on your API keys.

### Required Environment Variables

The API requires the following environment variables:

- `ANTHROPIC_API_KEY` - For Claude API calls
- `NOTION_API_KEY` - For Notion API calls
- `NOTION_DATABASE_ID` - Target Notion database
- `API_SECRET` - Secret key for API authentication (use a strong, random value)

These should be configured in your Vercel deployment environment variables.

### Security Features

The API includes several security measures:

- **Constant-time API key comparison** - Prevents timing attacks on API key validation
- **URL validation** - Only allows HTTP/HTTPS protocols (blocks file://, javascript:, data:, etc. to prevent SSRF and XSS)
- **Request size limits** - Maximum request body size of 10KB to prevent DoS attacks

### Error Responses

- **400 Bad Request** - Missing or invalid `Authorization` header, invalid API key, invalid URL format/protocol, or request body too large

---

## Related Documentation

- [Extension Setup](./EXTENSION.md) - Browser extension that uses this API
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to Vercel
- [Main README](../README.md) - Project overview
