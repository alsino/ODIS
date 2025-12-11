# Datawrapper MCP Server

MCP server for creating data visualizations using the Datawrapper API. Enables automatic chart creation from Berlin open data through conversational AI.

## Features

- **Bar Charts**: Horizontal bars with variants (basic, stacked, split)
- **Column Charts**: Vertical columns with variants (basic, grouped, stacked)
- **Line Charts**: Single and multi-series line charts for time-series data
- **Area Charts**: Filled area charts
- **Scatter Plots**: X/Y scatter plots for correlation analysis
- **Dot Plots**: Horizontal dot plots with legend
- **Range Plots**: Show min/max ranges with labeled endpoints
- **Arrow Plots**: Show change direction between two values
- **Pie & Donut Charts**: Part-to-whole visualizations
- **Election Donuts**: Parliament-style seat distribution charts
- **Tables**: Formatted data tables
- **Maps**: GeoJSON visualization (symbol maps, choropleth)
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
- `chart_type` (required): Type of visualization (see below)
- `variant` (optional): Chart variant for bar/column charts
- `map_type` (required for maps): `'d3-maps-symbols'` or `'d3-maps-choropleth'`
- `title` (optional): Chart title (auto-generated if omitted)
- `description` (optional): Chart description/byline
- `source_dataset_id` (optional): Berlin dataset ID for tracking

**Supported Chart Types**:

| Type | Variants | Description |
|------|----------|-------------|
| `bar` | basic, stacked, split | Horizontal bar charts |
| `column` | basic, grouped, stacked | Vertical column charts |
| `line` | - | Line charts |
| `area` | - | Area charts |
| `scatter` | - | Scatter plots (requires 2+ numeric columns) |
| `dot` | - | Dot plots with legend |
| `range` | - | Range plots (requires 2 numeric columns) |
| `arrow` | - | Arrow plots (requires 2 numeric columns) |
| `pie` | - | Pie charts |
| `donut` | - | Donut charts |
| `election-donut` | - | Election/parliament donut charts |
| `table` | - | Data tables |
| `map` | - | GeoJSON maps (requires map_type) |

**Examples**:

```javascript
// Basic bar chart
{
  data: [
    { district: "Mitte", population: 380000 },
    { district: "Pankow", population: 410000 }
  ],
  chart_type: "bar",
  title: "Population by District"
}

// Stacked column chart
{
  data: [
    { year: "2020", online: 45, offline: 30 },
    { year: "2021", online: 55, offline: 25 }
  ],
  chart_type: "column",
  variant: "stacked"
}

// Range plot (shows salary gap)
{
  data: [
    { category: "Berlin", Women: 52000, Men: 61000 },
    { category: "Munich", Women: 48000, Men: 58000 }
  ],
  chart_type: "range"
}

// Scatter plot
{
  data: [
    { city: "Berlin", population: 3.6, area: 891 },
    { city: "Munich", population: 1.5, area: 310 }
  ],
  chart_type: "scatter"
}
```

## Testing

```bash
# Run unit tests
npm test

# Run live API tests (creates actual charts in Datawrapper)
npm run build && node dist/tests/test-chart-types.js
```

## Documentation

- [Design Specification](docs/plans/design-spec.md) - Complete design and architecture
- [Implementation Plan](docs/plans/implementation-plan-extended-charts.md) - Extended chart types implementation

## Project Structure

```
datawrapper-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── datawrapper-client.ts # Datawrapper API wrapper
│   ├── chart-builder.ts      # Smart defaults engine & validation
│   ├── chart-logger.ts       # Chart provenance logging
│   └── types.ts              # TypeScript interfaces
├── src/tests/
│   ├── chart-builder.test.ts # Unit tests for chart builder
│   ├── index.test.ts         # Integration tests
│   └── test-chart-types.ts   # Live API tests
├── dist/                     # Compiled JavaScript
├── docs/plans/               # Design documents
├── charts-log.json          # Created charts log (generated)
└── README.md
```

## License

ISC
