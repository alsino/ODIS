# Interface Prototype

Web-based chat interface for the Berlin Open Data MCP server.

## Architecture

- **Frontend**: Svelte + Vite chat UI (port 5173)
- **Backend**: Node.js/Express + WebSocket server (port 3000)
- **MCP Server**: Berlin Open Data MCP (spawned by backend)
- **AI**: Claude API for conversation orchestration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your Claude API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

3. Build the Berlin MCP server (if not already built):
```bash
cd ../berlin-open-data-mcp
npm install
npm run build
cd ../interface-prototype
```

## Development

Start backend and frontend in separate terminals:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

Open browser to http://localhost:5173

## Production Build

```bash
npm run build
npm start
```

## Project Structure

- `backend/` - Express server, MCP client, Claude API integration
- `frontend/` - Svelte chat interface
- `docs/plans/` - Design spec and implementation plan

## How It Works

1. User types message in web UI
2. Frontend sends via WebSocket to backend
3. Backend forwards to Claude API with available MCP tools
4. Claude decides which tools to call
5. Backend executes tools via Berlin MCP server
6. Backend sends results back to Claude
7. Claude generates final response
8. Backend streams response to frontend
9. Frontend displays response in chat

## Testing

```bash
npm test
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required. Your Claude API key
- `PORT` - Optional. Backend port (default: 3000)
- `BERLIN_MCP_PATH` - Optional. Path to Berlin MCP server
