# Architecture Documentation

## Overview

Recipe Clipper for Notion is a full-stack application that scrapes recipe websites, analyzes them with AI, and saves them to Notion with structured formatting and metadata. The system is designed as a monorepo supporting three deployment modes:

1. **Browser Extension** (Chrome/Edge) - Popup interface for saving recipes from the current tab
2. **Web Interface** - Standalone web app for manual URL entry
3. **CLI Tool** - Command-line interface for batch operations and automation

## System Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      User Interfaces                      │
├────────────────────┬─────────────────┬────────────────────┤
│  Chrome Extension  │  Web Interface  │  CLI Tool          │
│  (Solid.js)        │  (Solid.js)     │  (Node.js script)  │
└────────┬───────────┴───────┬─────────┴───────┬────────────┘
         │                   │                 │
         └───────────────────┴─────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │    API Layer                        │
         │  - Authentication                   │
         │  - Rate limiting                    │
         │  - SSE streaming                    │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │     Recipe Processing Pipeline      │
         │  1. Scraper (Python subprocess)     │
         │  2. AI Tagger (Claude API)          │
         │  3. Notion Formatter                │
         │  4. Notion API Client               │
         └─────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
  ┌──────────────┐                   ┌──────────────┐
  │  Notion API  │                   │  Claude API  │
  │  (External)  │                   │  (External)  │
  └──────────────┘                   └──────────────┘
```

## Module Organization

### 1. `/backend` - Server-Side Logic

Core Node.js/TypeScript backend handling recipe processing:

- **`server.ts`** - Production Express server with full middleware stack
- **`cli-server.ts`** - Minimal server for CLI mode (no auth/rate limiting)
- **`process-recipe.ts`** - Main orchestration pipeline
- **`scraper.ts`** - Python subprocess integration for recipe extraction
- **`tagger.ts`** - Claude API client for AI-powered recipe analysis
- **`config.ts`** - Environment variable validation with Zod schemas
- **`security.ts`** - Constant-time string comparison, SSRF protection
- **`rate-limit.ts`** - In-memory token bucket rate limiter
- **`errors.ts`** - Custom error hierarchy

**Notion Integration:**
- **`notion/blocks.ts`** - Notion block builders (paragraphs, lists, columns)
- **`notion/properties.ts`** - Property builders (title, multi-select, numbers)
- **`notion/types.ts`** - Notion API type definitions
- **`notion/duplicates.ts`** - Duplicate detection via database queries

**Python Scraper:**
- **`parsers/`** - Python recipe-scrapers integration
- Executed as subprocess via Node.js `spawn()`
- Extracts: name, ingredients, instructions, author, prep/cook times

### 2. `/api` - Serverless API Routes (Vercel)

Vercel serverless functions wrapping backend logic:

- **`recipes.ts`** - POST /api/recipes - Main recipe save endpoint
- **`health.ts`** - GET /api/health - Health check
- **`assets.ts`** - GET /api/assets/* - Static asset serving
- **`index.ts`** - GET /api - API documentation
- **`asset-routes.ts`** - Asset routing logic
- **`asset-utils.ts`** - Asset helper functions

### 3. `/shared` - Isomorphic Code

Code shared between extension, web, and backend:

**Components (Solid.js):**
- **`extension-recipe-form.tsx`** - Extension popup form
- **`web-recipe-form.tsx`** - Web interface form
- **`status-message.tsx`** - Status display component
- **`progress-indicator.tsx`** - Loading/progress component
- **`api-secret-prompt.tsx`** - Modal for API key entry
- **`url-display.tsx`** - URL/title display in extension
- **`recipe-info.tsx`** - Recipe metadata display
- **`settings-panel.tsx`** - API key management

**Hooks:**
- **`use-recipe-save.ts`** - Recipe save logic with SSE streaming
- **`use-theme.ts`** - Light/dark mode management
- **`use-timeout.ts`** - Timeout management with auto-cleanup
- **`use-query-params.ts`** - Query parameter handling for bookmarklet

**API Client:**
- **`api/client.ts`** - Recipe save API client with SSE
- **`api/sse-utils.ts`** - Server-Sent Events stream parser
- **`api/validation.ts`** - Zod schemas for SSE event validation
- **`api/types.ts`** - Shared API type definitions

**Utilities:**
- **`storage.ts`** - Storage adapter pattern (chrome.storage / localStorage)
- **`url-utils.ts`** - URL validation and manipulation
- **`format-utils.ts`** - Time/data formatting
- **`error-utils.ts`** - Error detection helpers
- **`type-guards.ts`** - TypeScript type guards
- **`constants.ts`** - Shared constants and error messages

### 4. `/extension` - Browser Extension

Chrome extension specific code:

- **`popup/`** - Extension popup (Solid.js)
- **`background/`** - Service worker for extension lifecycle
- **`content/`** - Content scripts for recipe metadata extraction
- **`manifest.json`** - Extension configuration
- **`styles.css`** - Extension-specific styles

### 5. `/web` - Web Interface

Standalone web application:

- **`index.html`** - Web interface entry point
- **`App.tsx`** - Main web app component
- **`styles.css`** - Web-specific styles
- Deployed to Vercel alongside API routes

### 6. `/scripts` - Build System

TypeScript build scripts using esbuild:

- **`build-extension.ts`** - Bundles extension (popup, background, content)
- **`build-web.ts`** - Bundles web interface
- **`build-utils.ts`** - Shared build utilities
- **`watch.ts`** - Development file watcher

## Data Flow

### Recipe Save Flow (End-to-End)

```
1. User Input
   ├─ Extension: Current tab URL (auto-detected)
   ├─ Web: Manual URL entry
   └─ CLI: Command-line argument

2. Client-Side Validation
   ├─ URL format validation (HTTP/HTTPS only)
   ├─ API key check (prompt if missing)
   └─ Duplicate check initiation

3. API Request (POST /api/recipes)
   ├─ Headers: Authorization: Bearer <API_KEY>
   ├─ Body: { url: string, stream: boolean }
   └─ Response: SSE stream or JSON

4. Server-Side Processing
   ├─ Authentication: Verify API secret (constant-time)
   ├─ Rate Limiting: Token bucket (10 req/min)
   ├─ Duplicate Check: Query Notion database by URL
   │  └─ If found: Return 409 with Notion URL
   └─ Process Recipe Pipeline:

5. Recipe Scraping (Python)
   ├─ Spawn Python subprocess
   ├─ Run recipe-scrapers library
   ├─ Extract structured data:
   │  ├─ Name, author
   │  ├─ Ingredients (array)
   │  ├─ Instructions (array)
   │  └─ Times (prep, cook, total)
   └─ Return JSON to Node.js

6. AI Tagging (Claude API)
   ├─ Send recipe data to Claude
   ├─ Claude analyzes and generates:
   │  ├─ Tags (e.g., "dessert", "baking")
   │  ├─ Meal type (Breakfast/Lunch/Dinner/Dessert/Snack)
   │  ├─ Health score (0-10)
   │  └─ Total time (minutes)
   └─ Parse structured JSON response

7. Notion Formatting
   ├─ Build page properties:
   │  ├─ Title (recipe name)
   │  ├─ URL (source URL)
   │  ├─ Tags (multi-select)
   │  ├─ Meal Type (select)
   │  ├─ Health Score (number)
   │  └─ Times (numbers)
   └─ Build page blocks:
      ├─ Author (paragraph)
      ├─ Tags (paragraph)
      ├─ Metadata (paragraph)
      ├─ Ingredients & Instructions (2-column layout)
      │  ├─ Left: Bulleted ingredient list
      │  └─ Right: Numbered instruction list

8. Notion API Save
   ├─ POST to Notion API (create page)
   ├─ Retry with exponential backoff on rate limits
   └─ Return page ID and URL

9. SSE Progress Updates (Streamed to Client)
   ├─ "Scraping recipe..." (progress)
   ├─ "Analyzing with AI..." (progress)
   ├─ "Saving to Notion..." (progress)
   └─ "Complete!" (complete event with full data)

10. Client-Side Handling
    ├─ Update progress indicator
    ├─ Show success message with Notion link
    ├─ Display recipe metadata (extension only)
    └─ Clear URL input (web only)
```

## Key Design Decisions

### 1. Why Python for Scraping?

**Decision:** Use Python `recipe-scrapers` library as a subprocess instead of pure Node.js.

**Rationale:**
- **Best-in-class library**: `recipe-scrapers` supports 180+ recipe websites with high accuracy
- **Active maintenance**: Community-driven with regular updates for new sites
- **Proven reliability**: Used by thousands of developers
- **Language trade-off**: The small overhead of subprocess spawning is worth the scraping quality

**Implementation:**
- Spawn Python process via `child_process.spawn()`
- Communicate via stdin/stdout with JSON
- Graceful error handling if Python not available (development mode)

### 2. Why Solid.js?

**Decision:** Use Solid.js for UI components instead of React.

**Rationale:**
- **True reactivity**: Fine-grained reactivity without virtual DOM overhead
- **Small bundle size**: ~7KB minified (vs React ~40KB)
- **Similar API**: JSX syntax familiar to React developers
- **Performance**: Faster than React for small interactive UIs
- **Good fit**: Perfect for extension popups with size constraints

### 3. Why Server-Sent Events (SSE)?

**Decision:** Stream progress updates via SSE instead of polling or WebSockets.

**Rationale:**
- **Unidirectional**: Server-to-client only (perfect for progress updates)
- **Simpler than WebSockets**: No connection upgrade or protocol complexity
- **HTTP-friendly**: Works through proxies, load balancers, and Vercel
- **Built-in reconnection**: Browsers automatically reconnect on disconnect
- **Progress visibility**: Users see real-time updates during 10-30 second recipe processing

**Protocol:**
```
Event Types:
- progress: { type: "progress", message: string, progressType: string }
- complete: { type: "complete", success: true, pageId: string, notionUrl: string, recipe: {...}, tags: {...} }
- error: { type: "error", success: false, error: string, notionUrl?: string }
```

### 4. Why In-Memory Rate Limiting?

**Decision:** Use in-memory token bucket instead of Redis/database.

**Rationale:**
- **Stateless serverless limitation**: Vercel functions can't maintain shared state
- **Simple API protection**: Goal is to prevent accidental abuse, not sophisticated attacks
- **Acceptable trade-off**: Per-instance limits sufficient for personal tool
- **No infrastructure**: Avoids external dependencies (Redis, DynamoDB)

**Limitation:** Each serverless function instance has its own rate limit counter.

### 5. Why Monorepo?

**Decision:** Single repository with extension, web, CLI, and backend.

**Rationale:**
- **Code sharing**: Components, hooks, utilities, and types shared across all interfaces
- **Consistent UX**: Shared components ensure consistent behavior
- **Easier maintenance**: Single source of truth for business logic
- **Type safety**: End-to-end type safety from frontend to backend
- **Simple deployment**: One repository to manage

### 6. Why Zod for Validation?

**Decision:** Use Zod for runtime validation instead of JSON Schema or Yup.

**Rationale:**
- **TypeScript-first**: Type inference from schemas (single source of truth)
- **Excellent DX**: Clear error messages and composable schemas
- **Runtime safety**: Validates data from external sources (API, storage, Python subprocess)
- **Discriminated unions**: Perfect for SSE event validation

### 7. Why Storage Adapter Pattern?

**Decision:** Abstract storage behind adapter pattern instead of direct API calls.

**Rationale:**
- **Environment-agnostic**: Same code works in extension (chrome.storage) and web (localStorage)
- **Testing**: Easy to mock in tests
- **Migration**: Could switch storage backends without changing consumers
- **Type safety**: Consistent interface with proper TypeScript types

**Implementation:**
```typescript
interface StorageAdapter {
  getApiKey(): Promise<string | null>;
  saveApiKey(key: string): Promise<void>;
}

// Extension: chrome.storage.sync
// Web: localStorage with async wrapper
```

## Security Architecture

### 1. API Authentication

- **Bearer tokens**: API secret in `Authorization: Bearer <secret>` header
- **Environment variable**: `API_SECRET` set in Vercel dashboard
- **Constant-time comparison**: Prevents timing attacks via `crypto.timingSafeEqual()`
- **Client-side storage**: Encrypted in chrome.storage.sync (extension) or localStorage (web)

### 2. Rate Limiting

- **Token bucket algorithm**: 10 requests per minute per IP
- **Graceful degradation**: 429 status with Retry-After header
- **No permanent bans**: Allows legitimate bursts

### 3. Input Validation

- **URL validation**: Only HTTP/HTTPS allowed (blocks file://, chrome://, etc.)
- **SSRF protection**: URL validation before scraping (prevents internal network access)
- **Zod schemas**: Runtime validation of all external data (API requests, SSE events, Python output)
- **Size limits**: Request body limited to 1MB

### 4. Error Handling

- **No stack traces in production**: Generic error messages for security
- **Sensitive data scrubbing**: API keys never logged or returned in responses
- **Error classification**: User-facing vs internal errors properly separated

## Integration Points

### 1. Claude API (Anthropic)

**Endpoint:** `https://api.anthropic.com/v1/messages`

**Request:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 1024,
  "messages": [{
    "role": "user",
    "content": "Analyze this recipe and return JSON..."
  }]
}
```

**Response:**
```json
{
  "id": "msg_...",
  "content": [{
    "type": "text",
    "text": "{\"tags\": [...], \"mealType\": \"...\", ...}"
  }]
}
```

**Error Handling:**
- Rate limit (429): Exponential backoff
- Auth error (401): Return user-friendly message
- API error (5xx): Fallback to default tags

### 2. Notion API

**Endpoints:**
- `POST /v1/pages` - Create page
- `POST /v1/databases/{id}/query` - Check duplicates

**Authentication:** Integration token in `Authorization: Bearer <token>` header

**Request (Create Page):**
```json
{
  "parent": { "database_id": "..." },
  "properties": {
    "Name": { "title": [{ "text": { "content": "Recipe Name" } }] },
    "Tags": { "multi_select": [{ "name": "dessert" }] },
    "URL": { "url": "https://..." }
  },
  "children": [
    { "type": "paragraph", "paragraph": { "rich_text": [...] } }
  ]
}
```

**Error Handling:**
- Rate limit (429): Retry with exponential backoff
- Invalid token (401): Return auth error to user
- Validation error (400): Log and return user-friendly message

### 3. Python Recipe-Scrapers

**Execution:** Node.js subprocess via `child_process.spawn()`

**Command:**
```bash
python3 backend/parsers/run.py <URL>
```

**Output (stdout):**
```json
{
  "name": "Recipe Name",
  "author": "Author Name",
  "ingredients": ["1 cup flour", "2 eggs"],
  "instructions": ["Mix ingredients", "Bake at 350°F"],
  "prep_time": 15,
  "cook_time": 30,
  "total_time": 45
}
```

**Error Handling:**
- Parse failure: Return error to client
- Process crash: Catch and log, return generic error
- Python not found (dev): Graceful degradation with notice

## Build System

### esbuild Configuration

**Why esbuild?**
- **Speed**: 10-100x faster than Webpack
- **Simple**: Single-file config vs complex Webpack setup
- **Built-in**: TypeScript, JSX, minification, source maps
- **Watch mode**: Fast incremental rebuilds

**Build Targets:**

1. **Extension** (`scripts/build-extension.ts`)
   - Entry points: popup, background, content script
   - Output: `dist/extension/`
   - Bundle: True (single file per entry)
   - Platform: Browser
   - Minify: Production only

2. **Web** (`scripts/build-web.ts`)
   - Entry point: `web/App.tsx`
   - Output: `dist/web/`
   - Bundle: True
   - Platform: Browser
   - Minify: Production only

3. **Backend** (TypeScript compilation)
   - Compiler: `tsc`
   - Output: `dist/backend/`
   - Source maps: Yes
   - Preserves structure

### Development Workflow

```bash
# Development (watch mode)
bun run dev              # Starts all watchers + server

# Production build
bun run build            # Builds all artifacts

# Linting & formatting
bun run lint             # Biome linter
bun run format           # Biome formatter
bun run typecheck        # TypeScript type checking
```

## Deployment

### Vercel

**Configuration:** `vercel.json`

```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x"
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/web/index.html" }
  ]
}
```

**Environment Variables:**
- `API_SECRET` - Authentication token for API
- `ANTHROPIC_API_KEY` - Claude API key
- `NOTION_TOKEN` - Notion integration token
- `NOTION_DATABASE_ID` - Target Notion database ID

**Deployment:**
```bash
vercel --prod  # Deploys web + API routes
```

### Chrome Web Store

**Manifest:** `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Recipe Clipper for Notion",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://*/*"]
}
```

**Build & Package:**
```bash
bun run build:extension
cd dist/extension && zip -r extension.zip .
```

**Upload:** Submit `extension.zip` to Chrome Web Store Developer Dashboard

## Performance Considerations

### Bundle Sizes

- **Extension popup**: ~50KB minified + gzipped
- **Web interface**: ~60KB minified + gzipped
- **Chrome manifest + background**: ~5KB

### Optimization Techniques

1. **Code splitting**: Separate bundles for extension/web/CLI
2. **Tree shaking**: Remove unused code via esbuild
3. **Minification**: Production builds fully minified
4. **Lazy loading**: Dynamic imports for optional features
5. **Solid.js**: Fine-grained reactivity reduces re-renders

### API Performance

- **SSE streaming**: Users see progress immediately (perceived performance)
- **Parallel processing**: Claude API and Notion API calls could be parallelized (future optimization)
- **Caching**: Duplicate detection caches Notion database queries (via Notion API)

## Testing Strategy

**Current State:** No automated tests (as of documentation time)

**Recommended Testing Approach:**

1. **Unit Tests** (Vitest)
   - Utility functions (url-utils, format-utils, type-guards)
   - Pure functions (block builders, property builders)
   - Error handling logic

2. **Integration Tests**
   - API endpoints (supertest)
   - Recipe processing pipeline
   - SSE stream parsing

3. **E2E Tests** (Playwright)
   - Extension popup flow
   - Web interface flow
   - API error handling

4. **Type Tests**
   - TypeScript compilation as test suite
   - Zod schema validation tests

## Monitoring & Observability

**Current State:** Console logging only

**Recommended Improvements:**

1. **Structured Logging**: Replace `console.log` with structured logger (pino, winston)
2. **Error Tracking**: Sentry integration for production errors
3. **Metrics**: Track recipe save success rate, processing times
4. **Health Checks**: `/api/health` endpoint for monitoring
5. **Alerts**: Notify on high error rates or API failures

## Future Architectural Considerations

### Scalability

**Current Limitations:**
- In-memory rate limiting (per-instance)
- No request queuing (high traffic = dropped requests)
- Python subprocess overhead (one per request)

**Potential Solutions:**
- Redis for distributed rate limiting
- Message queue (SQS, RabbitMQ) for async processing
- Python service with persistent workers (FastAPI)
- Horizontal scaling via Vercel's auto-scaling

### Multi-User Support

**Current State:** Single-user tool (one Notion database, one API secret)

**Multi-User Architecture:**
- User authentication (Auth0, Clerk)
- Database per user (store Notion tokens)
- OAuth Notion integration (instead of manual tokens)
- Subscription management (Stripe)

### Extensibility

**Plugin System:**
- Custom scrapers for unsupported sites
- Custom Notion templates
- Post-processing hooks (image upload, unit conversion)

**API Extensions:**
- Bulk import (CSV, JSON)
- Recipe editing/updating
- Recipe sharing (public links)

## Appendix: File Structure

```
recipe-to-notion/
├── api/                    # Vercel serverless functions
│   ├── recipes.ts
│   ├── health.ts
│   └── assets.ts
├── backend/                # Core server logic
│   ├── server.ts
│   ├── process-recipe.ts
│   ├── scraper.ts
│   ├── tagger.ts
│   ├── notion/
│   └── parsers/           # Python scrapers
├── extension/              # Browser extension
│   ├── popup/
│   ├── background/
│   ├── content/
│   └── manifest.json
├── web/                    # Web interface
│   ├── App.tsx
│   └── index.html
├── shared/                 # Isomorphic code
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── storage.ts
├── scripts/                # Build scripts
│   ├── build-extension.ts
│   ├── build-web.ts
│   └── watch.ts
├── docs/                   # Documentation
│   └── ARCHITECTURE.md    # This file
├── dist/                   # Build output
├── package.json
├── tsconfig.json
├── biome.json              # Linter/formatter config
└── vercel.json             # Vercel config
```

## Glossary

- **SSE**: Server-Sent Events - HTTP protocol for server-to-client streaming
- **Zod**: TypeScript-first schema validation library
- **Solid.js**: Reactive JavaScript framework with JSX
- **esbuild**: Ultra-fast JavaScript/TypeScript bundler
- **Biome**: Fast linter and formatter (Prettier/ESLint replacement)
- **Recipe-Scrapers**: Python library for extracting recipes from websites
- **Token Bucket**: Rate limiting algorithm allowing bursts
- **SSRF**: Server-Side Request Forgery - security vulnerability
