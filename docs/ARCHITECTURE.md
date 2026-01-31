# Architecture

Recipe Clipper for Notion scrapes recipe websites, analyzes them with Claude AI, and saves structured data to Notion. It's designed as a monorepo with three interfaces:

- **Browser Extension** - One-click saving from Chrome/Edge
- **Web Interface** - Mobile-friendly manual entry  
- **CLI Tool** - Batch operations and automation

## System Flow

1. **Client** (Extension/Web/CLI) sends recipe URL to API
2. **API Layer** authenticates and rate-limits requests
3. **Recipe Pipeline**:
   - Scrape recipe data (Python subprocess with recipe-scrapers)
   - Analyze with Claude AI (tags, meal type, health score, time)
   - Format for Notion (2-column layout: ingredients left, instructions right)
   - Save to Notion via API
4. **Progress** streamed to client via Server-Sent Events (SSE)

## Key Technologies

- **Backend**: Node.js/TypeScript with Express
- **Frontend**: Solid.js (small bundle size, ~7KB vs React ~40KB)
- **Scraping**: Python recipe-scrapers library (600+ sites supported)
- **AI**: Claude API for recipe analysis
- **Validation**: Zod for runtime type safety
- **Build**: esbuild for fast bundling
- **Hosting**: Vercel serverless functions

## Project Structure

```
recipe-to-notion/
├── api/           # Vercel serverless routes
├── backend/       # Core server logic (scraping, AI, Notion)
├── extension/     # Chrome extension
├── web/           # Web interface
├── shared/        # Shared components, hooks, utilities
└── scripts/       # Build scripts
```

## Security

- **Authentication**: Bearer token via `Authorization` header, constant-time comparison
- **Rate Limiting**: Token bucket (10 req/min per IP)  
- **Validation**: URL validation (HTTP/HTTPS only), Zod schemas for all data
- **Storage**: API keys in chrome.storage.local (extension) or localStorage (web)

## Deployment

**Vercel** (primary):
- TypeScript functions in `/api` automatically deployed
- Python scraper runs as serverless function
- Web interface served from `/web`

**Chrome Web Store**:
- Build: `bun run build:extension`
- Package `dist/extension/` as zip
- Upload to Chrome Web Store

## Design Decisions

**Why Python for scraping?** The recipe-scrapers library supports 600+ sites with high accuracy. The subprocess overhead is worth the quality.

**Why Solid.js?** Smaller bundles than React (~7KB), fine-grained reactivity, perfect for extension popups.

**Why SSE instead of WebSockets?** Unidirectional server-to-client, works through proxies and Vercel, simpler than WebSockets.

**Why monorepo?** Code sharing across extension/web/backend, consistent UX, single deployment.
