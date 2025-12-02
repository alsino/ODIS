# Datawrapper MCP Server

MCP server for creating data visualizations using the Datawrapper API. Enables automatic chart creation from Berlin open data through conversational AI.

## Features

- **Bar Charts**: Vertical/horizontal bar charts with automatic axis detection
- **Line Charts**: Single and multi-series line charts for time-series data
- **Maps**: GeoJSON visualization with automatic Berlin bounds
- **Smart Defaults**: Automatic titles, labels, and axes from data structure
- **Provenance Tracking**: JSON log of created charts with source dataset links

## Setup

### Prerequisites

- Node.js 18+
- Datawrapper API token

### Installation

```bash
npm install
npm run build
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your Datawrapper API token to `.env`:
```
DATAWRAPPER_API_TOKEN=your_token_here
```

To get a Datawrapper API token:
1. Create account at https://app.datawrapper.de/
2. Navigate to Settings → API Tokens
3. Create new token with permissions: `chart:read`, `chart:write`, `chart:publish`

### Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datawrapper": {
      "command": "node",
      "args": ["/absolute/path/to/datawrapper-mcp/dist/index.js"],
      "env": {
        "DATAWRAPPER_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Usage with interface-prototype

The server integrates with the berlin-open-data-mcp workflow. See `docs/plans/design-spec.md` for integration details.

## MCP Tools

### `create_visualization`

Create a data visualization using Datawrapper.

**Parameters**:
- `data` (required): Array of objects or GeoJSON FeatureCollection
- `chart_type` (required): `'bar'`, `'line'`, or `'map'`
- `title` (optional): Chart title (auto-generated if omitted)
- `description` (optional): Chart description/byline
- `source_dataset_id` (optional): Berlin dataset ID for tracking

**Example**:
```javascript
{
  data: [
    { district: "Mitte", population: 380000 },
    { district: "Pankow", population: 410000 }
  ],
  chart_type: "bar",
  title: "Population by District"
}
```

## Documentation

- [Design Specification](docs/plans/design-spec.md) - Complete design and architecture
- [Implementation Plan](docs/plans/implementation-plan.md) - Step-by-step implementation guide

## Project Structure

```
datawrapper-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── datawrapper-client.ts # Datawrapper API wrapper
│   ├── chart-builder.ts      # Smart defaults engine
│   ├── chart-logger.ts       # Chart provenance logging
│   └── types.ts              # TypeScript interfaces
├── dist/                     # Compiled JavaScript
├── docs/plans/               # Design documents
├── charts-log.json          # Created charts log (generated)
└── README.md
```

## License

ISC
