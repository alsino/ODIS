# Berlin Simple Open Data (Soda)

A collection of MCP (Model Context Protocol) servers and tools for working with Berlin's open data ecosystem.

## Structure

This repository contains multiple components:

### `/berlin-open-data-mcp`

MCP server for natural language discovery and fetching of Berlin's open datasets. Connects to the Berlin Open Data Portal (daten.berlin.de) and enables:
- Natural language dataset search
- Data fetching with smart sampling
- CSV, JSON, and Excel support
- Browser automation for JavaScript-rendered downloads

See [berlin-open-data-mcp/README.md](berlin-open-data-mcp/README.md) for details.

### `/datawrapper-mcp`

*(Planned)* MCP server for creating visualizations using the Datawrapper API. Will enable automatic chart generation from Berlin open data.

### `/interface-prototype`

*(Planned)* Prototype interface demonstrating the integration of both MCP servers for end-to-end workflows: data discovery → data fetching → visualization.

## Getting Started

Each component has its own setup instructions in its respective directory.

## Development

See [CLAUDE.md](CLAUDE.md) for collaboration guidelines and development practices.
