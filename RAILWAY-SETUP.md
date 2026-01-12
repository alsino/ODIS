# Railway Multi-Service Deployment

This monorepo deploys as 3 separate Railway services from the same repository.

## Services

### 1. bod-mcp (Berlin Open Data MCP)

| Setting | Value |
|---------|-------|
| **Dockerfile** | `berlin-open-data-mcp/Dockerfile` |
| **Domain** | `bod-mcp.railway.app` |
| **Endpoints** | `/mcp`, `/health` |

**Environment Variables:**
- None required (public data API)

---

### 2. datawrapper-mcp

| Setting | Value |
|---------|-------|
| **Dockerfile** | `datawrapper-mcp/Dockerfile` |
| **Domain** | `datawrapper-mcp.railway.app` |
| **Endpoints** | `/mcp`, `/health` |

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `DATAWRAPPER_API_TOKEN` | Yes | Datawrapper API token for chart creation |
| `DATAWRAPPER_MCP_AUTH_TOKEN` | No | If set, requires Bearer auth for `/mcp` endpoint |

---

### 3. mcp-interface-prototype

| Setting | Value |
|---------|-------|
| **Dockerfile** | `interface-prototype/Dockerfile` |
| **Domain** | `mcp-interface-prototype.railway.app` |
| **Endpoints** | `/` (chat UI), `/ws` (WebSocket) |

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for chat |
| `BOD_MCP_URL` | Yes | URL to bod-mcp service (e.g., `https://bod-mcp.railway.app`) |
| `DATAWRAPPER_MCP_URL` | No | URL to datawrapper-mcp service |
| `DATAWRAPPER_MCP_AUTH_TOKEN` | No | Auth token if datawrapper-mcp requires it |
| `DATAWRAPPER_API_KEY` | No | Only needed if NOT using DATAWRAPPER_MCP_URL |

---

## Setup Steps

### 1. Create Railway Project

```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2. Create Three Services

In the Railway dashboard:

1. Go to your project
2. Click "New Service" → "GitHub Repo" → Select this repository
3. Name it `bod-mcp`
4. In service settings:
   - Set "Root Directory" to `berlin-open-data-mcp`
   - Or set "Dockerfile Path" to `berlin-open-data-mcp/Dockerfile`
5. Generate a domain (e.g., `bod-mcp.railway.app`)

Repeat for:
- `datawrapper-mcp` (root: `datawrapper-mcp`)
- `mcp-interface-prototype` (root: `interface-prototype`)

### 3. Configure Environment Variables

For each service, go to "Variables" tab and add the required environment variables listed above.

**Important:** For `mcp-interface-prototype`, use the generated Railway domains:
```
BOD_MCP_URL=https://bod-mcp.up.railway.app
DATAWRAPPER_MCP_URL=https://datawrapper-mcp.up.railway.app
```

### 4. Deploy

Railway auto-deploys on git push. To manually deploy:

```bash
railway up
```

Or click "Deploy" in the Railway dashboard.

---

## Local Development

For local development, you can run all services together:

```bash
# Terminal 1: BOD MCP (port 3001)
cd berlin-open-data-mcp && PORT=3001 npm run start:http

# Terminal 2: Datawrapper MCP (port 3002)
cd datawrapper-mcp && PORT=3002 npm run start:http

# Terminal 3: Interface (port 3000)
cd interface-prototype/backend && \
  BOD_MCP_URL=http://localhost:3001 \
  DATAWRAPPER_MCP_URL=http://localhost:3002 \
  npm run start
```

Or use subprocess mode (no external MCP services needed):

```bash
cd interface-prototype/backend && npm run start
```

---

## Health Checks

All services expose a `/health` endpoint:

```bash
curl https://bod-mcp.railway.app/health
# {"status":"ok","service":"bod-mcp"}

curl https://datawrapper-mcp.railway.app/health
# {"status":"ok","service":"datawrapper-mcp"}
```

---

## Troubleshooting

### Service won't start
- Check the "Logs" tab in Railway dashboard
- Verify environment variables are set correctly
- Ensure Dockerfile path is correct

### Interface can't connect to MCP services
- Verify `BOD_MCP_URL` and `DATAWRAPPER_MCP_URL` are set correctly
- Check that MCP services are running (test `/health` endpoints)
- If using auth, verify `DATAWRAPPER_MCP_AUTH_TOKEN` matches

### Claude can't call tools
- Check `ANTHROPIC_API_KEY` is valid
- Verify MCP services are accessible from interface service
