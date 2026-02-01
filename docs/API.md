# API Reference

The Recipe Clipper for Notion server provides a REST API for processing recipes. Deploy to Vercel to use the API.

---

## Base URL

- **Vercel:** `https://your-app.vercel.app`

---

## Endpoints

### POST /api/recipes

Process and save a recipe to Notion.

#### Request

```bash
curl -X POST https://your-app.vercel.app/api/recipes \
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
  "message": "Checking for duplicates...",
  "progressType": "checking_duplicates"
}
```

Progress events are sent during processing. The `progressType` can be: `"checking_duplicates"`, `"scraping"`, `"tagging"`, or `"saving"`.

**Complete Event:**
```json
{
  "type": "complete",
  "success": true,
  "pageId": "abc123...",
  "notionUrl": "https://www.notion.so/abc123...",
  "recipe": {
    "name": "Recipe Name",
    "author": "Author Name",
    "ingredients": ["ingredient 1", "ingredient 2"],
    "instructions": ["step 1", "step 2"]
  },
  "tags": {
    "tags": ["tag1", "tag2"],
    "mealType": "Main",
    "healthScore": 7,
    "totalTimeMinutes": 30
  }
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
curl -X POST https://your-app.vercel.app/api/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{"url": "https://example.com/recipe", "stream": true}'
```

---

### GET /api/health

Health check endpoint to verify the server is running.

#### Request

```bash
curl https://your-app.vercel.app/api/health
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

The API implements rate limiting to prevent abuse and control costs. The default limit is **10 requests per minute** per client (IP address or API key).

### Rate Limit Headers

All responses include rate limit headers:

- `X-RateLimit-Limit` - Maximum number of requests allowed in the time window (default: 10)
- `X-RateLimit-Remaining` - Number of requests remaining in the current window
- `X-RateLimit-Reset` - ISO timestamp when the rate limit window resets

### Rate Limit Exceeded

When the rate limit is exceeded, the API returns:

- **Status Code:** `429 Too Many Requests`
- **Response Body:**
  ```json
  {
    "success": false,
    "error": "Rate limit exceeded. Please try again later."
  }
  ```

### Implementation Notes

- Rate limiting is applied per IP address or API key hash
- The current implementation uses in-memory storage (suitable for single-instance deployments)
- For production deployments with multiple serverless function instances, consider using a distributed rate limiting solution like:
  - [@upstash/ratelimit](https://github.com/upstash/ratelimit) with Redis
  - Vercel Edge Middleware with a Redis backend
  - Other distributed caching solutions

> **Note:** Vercel's serverless functions also have platform-level rate limiting based on your plan. Application-level rate limiting provides additional protection and cost control.

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

- **Constant-time API key comparison** - Prevents timing attacks
- **URL validation** - Only allows HTTP/HTTPS protocols (prevents SSRF and XSS)
- **Request size limits** - Maximum 10KB request body and 2048 character URLs
- **Request timeouts** - 30-second timeout on recipe scraping
- **Rate limiting** - 10 requests per minute per client
- **Security headers** - X-Content-Type-Options, X-Frame-Options, and Referrer-Policy
- **Error message sanitization** - Detailed errors logged server-side; generic messages returned to clients
- **Request correlation IDs** - Unique IDs for debugging and security incident response

### Error Responses

- **400 Bad Request** - Missing or invalid `Authorization` header, invalid API secret, invalid URL format/protocol, URL too long, or request body too large
- **429 Too Many Requests** - Rate limit exceeded