# Deployment Guide

The recipe-to-notion server can be deployed to various platforms. This guide covers deployment options for hosting the API server.

## Vercel (Recommended)

Vercel provides a free tier with excellent Bun runtime support. The code is already configured for Vercel deployment.

### Quick Deploy

1. **Login to Vercel:**
   ```bash
   bunx vercel login
   ```

2. **Deploy:**
   ```bash
   bunx vercel --prod
   ```

3. **Add environment variables:**
   - Go to your project settings on [vercel.com](https://vercel.com)
   - Navigate to Settings → Environment Variables
   - Add: `ANTHROPIC_API_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`
   - Select all environments (Production, Preview, Development)
   - Redeploy after adding variables (or wait for auto-deploy)

4. **Get your deployment URL:**
   - Vercel will provide a URL like `https://recipe-to-notion-xi.vercel.app`
   - Update your browser extension config to use this URL

**Note:** Vercel's free tier has a 60-second execution limit per function call, which is sufficient for most recipes (processing typically takes 30-45 seconds).

### Testing Your Deployment

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Test recipe processing
curl -X POST https://your-app.vercel.app/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"url": "https://cooking.nytimes.com/recipes/1234-example"}'
```

## Railway

Railway offers easy deployment with excellent Bun support.

1. **Create a new project** on [railway.app](https://railway.app)
2. **Connect your GitHub repository**
3. **Set environment variables:**
   - `ANTHROPIC_API_KEY`
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID`
4. **Configure start command:**
   ```bash
   bun src/cli-server.ts
   ```
5. **Set port** (optional): Railway automatically assigns a port, but you can set `SERVER_PORT` if needed

## Fly.io

Fly.io provides global edge deployment.

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create a fly.toml** (if not exists):
   ```toml
   app = "recipe-to-notion"
   primary_region = "iad"

   [build]

   [env]
     SERVER_PORT = "8080"

   [[services]]
     internal_port = 8080
     protocol = "tcp"

     [[services.ports]]
       port = 80
       handlers = ["http"]
       force_https = true

     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]
   ```

3. **Deploy:**
   ```bash
   fly deploy
   ```

4. **Set secrets:**
   ```bash
   fly secrets set ANTHROPIC_API_KEY=sk-ant-...
   fly secrets set NOTION_API_KEY=ntn_...
   fly secrets set NOTION_DATABASE_ID=abc123...
   ```

## Render

Render provides a simple web UI for deployment.

1. **Create a new Web Service** on [render.com](https://render.com)
2. **Connect your GitHub repository**
3. **Configure:**
   - **Build Command:** `bun install`
   - **Start Command:** `bun src/cli-server.ts`
   - **Environment:** Node (Render will use Bun if detected)
4. **Add environment variables:**
   - `ANTHROPIC_API_KEY`
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID`
   - `SERVER_PORT` (optional, defaults to 3000)

## DigitalOcean App Platform

1. **Create a new App** on DigitalOcean
2. **Connect your GitHub repository**
3. **Configure:**
   - **Build Command:** `bun install`
   - **Run Command:** `bun src/cli-server.ts`
4. **Add environment variables** in the App Settings

## VPS (DigitalOcean, Linode, AWS EC2, etc.)

For full control, deploy to any VPS.

1. **SSH into your server**
2. **Install Bun:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Clone the repository:**
   ```bash
   git clone https://github.com/willbiddy/recipe-to-notion.git
   cd recipe-to-notion
   bun install
   ```

4. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

5. **Set up process manager (PM2 recommended):**
   ```bash
   bun install -g pm2
   pm2 start "bun src/cli-server.ts" --name recipe-to-notion
   pm2 save
   pm2 startup
   ```

6. **Configure reverse proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. **Set up SSL (Let's Encrypt):**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Environment Variables

All deployment methods require these environment variables:

- `ANTHROPIC_API_KEY` - Your Anthropic API key (starts with `sk-ant-`)
- `NOTION_API_KEY` - Your Notion integration secret (starts with `ntn_`)
- `NOTION_DATABASE_ID` - Your Notion database ID (32-character hex string)
- `SERVER_PORT` - Optional, defaults to 3000 (not needed for Vercel)

## Port Configuration

- **Vercel:** Port is handled automatically
- **Other platforms:** Set `SERVER_PORT` environment variable (defaults to 3000)

## Health Checks

All deployments should respond to health checks at `/api/health`. Most platforms can use this for health monitoring:

- **Vercel:** Automatic
- **Railway:** Configure health check path: `/api/health`
- **Render:** Configure health check path: `/api/health`
- **Fly.io:** Configure in fly.toml
- **VPS:** Configure in your reverse proxy or load balancer
