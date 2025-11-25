# Berlin Simple Open Data (Soda)

A collection of MCP (Model Context Protocol) servers and tools for working with Berlin's open data ecosystem.

## Structure

This repository contains multiple components:

### `/berlin-open-data-mcp`

MCP server for natural language discovery and fetching of Berlin's open datasets. Connects to the Berlin Open Data Portal (daten.berlin.de) and enables:
- Natural language dataset search
- Data fetching with smart sampling for large datasets
- CSV, JSON, Excel, and WFS (Web Feature Service) support
- GeoJSON coordinate transformation (EPSG:25833 → WGS84)
- Browser automation for JavaScript-rendered downloads

See [berlin-open-data-mcp/README.md](berlin-open-data-mcp/README.md) for details.

### `/datawrapper-mcp`

*(Planned)* MCP server for creating visualizations using the Datawrapper API. Will enable automatic chart generation from Berlin open data.

### `/interface-prototype`

Web-based chat interface for exploring Berlin open data through natural language. Integrates the Berlin Open Data MCP server with Claude to enable:
- Conversational dataset search and discovery
- Data fetching and preview
- Accurate data analysis via sandboxed JavaScript code execution
- Real-time streaming responses via WebSocket

See [interface-prototype/README.md](interface-prototype/README.md) for setup and usage.

## Getting Started

Each component has its own setup instructions in its respective directory.

## Development

See [CLAUDE.md](CLAUDE.md) for collaboration guidelines and development practices.
