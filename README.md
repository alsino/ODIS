# Berlin Simple Open Data (Soda)

A collection of MCP (Model Context Protocol) servers and tools for working with Berlin's open data ecosystem.

**Live Demo**: https://interface-prototype.up.railway.app/

## Structure

This repository contains multiple components:

### `/berlin-open-data-mcp`

MCP server for natural language discovery and fetching of Berlin's open datasets. Connects to the Berlin Open Data Portal (daten.berlin.de) and enables:
- Natural language dataset search with smart query expansion
- Data fetching with smart sampling for large datasets
- Format support: CSV, JSON, Excel (XLS/XLSX), GeoJSON, KML, and WFS
- GeoJSON coordinate transformation (EPSG:25833 → WGS84)
- ZIP archive detection (provides direct download URLs)
- Browser automation for JavaScript-rendered downloads

See [berlin-open-data-mcp/README.md](berlin-open-data-mcp/README.md) for details.

### `/datawrapper-mcp`

MCP server for creating data visualizations using the Datawrapper API. Enables automatic chart creation from Berlin open data through conversational AI:
- Bar charts (vertical/horizontal)
- Line charts (single and multi-series)
- Maps (GeoJSON visualization with automatic Berlin bounds)
- Smart defaults for titles, labels, and axes
- Provenance tracking with source dataset links

See [datawrapper-mcp/README.md](datawrapper-mcp/README.md) for setup and API token configuration.

### `/interface-prototype`

Web-based chat interface for exploring Berlin open data through natural language. Integrates the Berlin Open Data MCP server with Claude to enable:
- Conversational dataset search and discovery
- Data fetching and preview
- Accurate data analysis via sandboxed JavaScript code execution
- Real-time streaming responses via WebSocket

See [interface-prototype/README.md](interface-prototype/README.md) for setup and usage.

## Using the MCP Servers

The MCP servers are deployed independently and can be used in multiple ways:

### Deployed Services

| Service | URL | Description |
|---------|-----|-------------|
| Berlin Open Data MCP | https://bod-mcp.up.railway.app | Dataset search and fetching |
| Datawrapper MCP | https://datawrapper-mcp.up.railway.app | Chart creation |
| Chat Interface | https://interface-prototype.up.railway.app | Web UI combining both |

### Remote Access (Claude Desktop)

Connect directly from Claude Desktop to access Berlin Open Data tools in any conversation:

```json
{
  "mcpServers": {
    "berlin-data": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://bod-mcp.up.railway.app/mcp"
      ]
    }
  }
}
```

Add this to your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop after updating the configuration.

**Requirements:**
- Claude Pro, Team, or Enterprise plan (remote MCP servers not available on free tier)
- Internet connection

### Remote Access (Mistral Le Chat)

Connect from [Le Chat](https://chat.mistral.ai/) using Custom MCP Connectors:

1. Go to **Intelligence** → **Connectors** → **+ Add Connector**
2. Select **Custom MCP Connector** tab
3. Add each server:

**Berlin Open Data MCP:**
| Field | Value |
|-------|-------|
| Connector Name | `berlin-open-data` |
| Connection Server | `https://bod-mcp.up.railway.app/mcp` |
| Authentication | No Authentication |

**Datawrapper MCP:**
| Field | Value |
|-------|-------|
| Connector Name | `datawrapper` |
| Connection Server | `https://datawrapper-mcp.up.railway.app/mcp` |
| Authentication | HTTP Bearer Token (contact admin for token) |

**Requirements:**
- Mistral account with Connector access
- Admin privileges for adding custom connectors

### Web Chat Interface

Visit https://interface-prototype.up.railway.app/ for a web-based chat interface with:
- Real-time tool execution display
- Conversational data exploration
- No authentication required

## Getting Started

Each component has its own setup instructions in its respective directory.
