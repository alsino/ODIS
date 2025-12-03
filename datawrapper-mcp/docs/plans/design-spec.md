# Datawrapper MCP Server - Design Specification

## Overview

The Datawrapper MCP server enables automatic visualization of Berlin open data by integrating with the Datawrapper API. It serves as a complementary tool to the berlin-open-data-mcp server, completing the data exploration workflow: search → fetch → analyze → **visualize**.

### Use Cases

1. **Standalone in Claude Desktop**: Users can create charts directly through Claude Desktop by providing data. Charts render inline as embedded iframes.
2. **Integrated Pipeline**: Works seamlessly with berlin-open-data-mcp in the interface-prototype, enabling conversational data visualization.

### MVP Scope

**Chart Types**:
- Bar charts (vertical/horizontal)
- Line charts (single/multi-series)
- Basic maps (GeoJSON visualization)

**Key Features**:
- Direct JSON data input (array of objects)
- Automatic smart defaults (titles, labels, colors inferred from data)
- GeoJSON support for maps (aligning with berlin-open-data-mcp WFS output)
- Automatic chart publishing (all charts publicly accessible)
- Simple provenance tracking (JSON log with source dataset links)

**Out of Scope for MVP**:
- Chart editing/updating after creation
- Chart deletion
- Manual styling/customization
- Non-GeoJSON map formats
- Private/draft charts

---

## Architecture

### Core Components

#### 1. MCP Server (`src/index.ts`)
- Implements MCP protocol using `@modelcontextprotocol/sdk`
- Exposes `create_visualization` tool
- Handles authentication via environment variable
- Returns embedded charts with URLs and metadata

#### 2. Datawrapper Client (`src/datawrapper-client.ts`)
- Wrapper around Datawrapper API v3 endpoints
- Methods:
  - `createChart(type, metadata)`: Create empty chart
  - `uploadData(chartId, data)`: Upload CSV/JSON data
  - `publishChart(chartId)`: Publish chart publicly
  - `getChartInfo(chartId)`: Retrieve chart URLs and metadata

#### 3. Chart Builder (`src/chart-builder.ts`)
- Smart defaults engine
- Functions:
  - `inferChartConfig(data, chartType)`: Generate optimal configuration
  - `generateTitle(data)`: Create descriptive titles
  - `detectColumnTypes(data)`: Identify column types (string/number/date)
  - `formatForDatawrapper(data)`: Convert to Datawrapper CSV format
  - `processGeoJSON(geojson)`: Handle map data
  - `stripGeoJSONProperties(geojson, mapType)`: Remove unnecessary properties to reduce tokens
  - `calculateBoundingBox(geojson)`: Calculate min/max coordinates for map view
  - `getSampleFeature(geojson)`: Get one feature for preview

#### 4. Chart Logger (`src/chart-logger.ts`)
- Maintains append-only JSON log
- Schema:
  ```typescript
  {
    chartId: string;
    url: string;
    embedCode: string;
    editUrl: string;
    chartType: 'bar' | 'line' | 'map';
    title: string;
    createdAt: string; // ISO timestamp
    sourceDatasetId?: string; // Berlin dataset ID
    sourceDatasetUrl?: string; // Original dataset URL
    dataRowCount: number;
  }
  ```

---

## MCP Tools

### `create_visualization`

Create a data visualization using the Datawrapper API.

**Parameters**:
```typescript
{
  data: Array<Record<string, any>> | GeoJSON;  // Required: Array of data objects or GeoJSON
  chart_type: 'bar' | 'line' | 'map';          // Required: Type of visualization
  map_type?: 'locator-map' | 'd3-maps-symbols' | 'd3-maps-choropleth'; // Required when chart_type is 'map'
  title?: string;                              // Optional: Chart title (auto-generated if omitted)
  description?: string;                        // Optional: Chart description/byline
  source_dataset_id?: string;                  // Optional: Berlin dataset ID for tracking
}
```

**Map Types** (when `chart_type` is "map"):
- `locator-map`: Show specific locations with markers (e.g., "where are the Christmas markets?")
- `d3-maps-symbols`: Visualize numeric data at point locations (e.g., "show visitor counts at each location")
- `d3-maps-choropleth`: Compare data across regions with color fills (e.g., "show population density by district")

**Example Usage**:
```javascript
// Bar chart from district data
{
  data: [
    { district: "Mitte", population: 380000 },
    { district: "Pankow", population: 410000 },
    { district: "Friedrichshain-Kreuzberg", population: 290000 }
  ],
  chart_type: "bar",
  title: "Population by District",
  source_dataset_id: "einwohnerzahl-berlin"
}

// Map from GeoJSON - Locator map
{
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [13.4, 52.5] },
        properties: { name: "Location A" }
      }
    ]
  },
  chart_type: "map",
  map_type: "locator-map"
}

// Map from GeoJSON - Symbol map with numeric data
{
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [13.4, 52.5] },
        properties: { name: "Location A", visitors: 100 }
      }
    ]
  },
  chart_type: "map",
  map_type: "d3-maps-symbols"
}
```

**Response Format**:
```
✅ Chart created successfully!

[CHART:abc123]
<iframe src="https://datawrapper.dwcdn.net/abc123/" ...></iframe>
[/CHART]

📊 **Chart URL**: https://datawrapper.dwcdn.net/abc123/
📝 **Embed code**: <iframe src="https://datawrapper.dwcdn.net/abc123/" ...></iframe>
✏️ **Edit**: https://app.datawrapper.de/chart/abc123/visualize
```

**Workflow**:
1. For maps: Claude asks user about visualization intent and determines map_type
2. Validate input data, chart type, and map_type (if applicable)
3. Apply smart defaults (title, axes, labels, bounding box)
4. Create chart via Datawrapper API
5. Upload formatted data (with stripped GeoJSON properties for maps)
6. Publish chart publicly
7. Log to charts-log.json
8. Return iframe embed + URLs + sample feature (for maps)

---

## Smart Defaults Logic

### Title Generation

**Priority order**:
1. User-provided `title` parameter
2. Infer from `source_dataset_id` (query CKAN for dataset title)
3. Generate from data structure: `"{first_column_name} Overview"`
4. Fallback: `"Data Visualization"`

**Example**:
- Dataset: "Einwohnerzahl nach Bezirken" → Title: "Einwohnerzahl nach Bezirken"
- Data with column "bezirk" → Title: "Bezirk Overview"

### Bar & Line Charts

**Axis Detection**:
- **X-axis (categorical)**: First column with string/date values
- **Y-axis (numeric)**: First column with numeric values
- **Multiple series**: Additional numeric columns become separate lines/bars

**Label Formatting**:
- Use column names directly as axis labels
- Capitalize first letter: `"bezirk"` → `"Bezirk"`
- Replace underscores: `"population_count"` → `"Population Count"`

**Example**:
```javascript
// Input data
[
  { month: "Jan", revenue: 1000, expenses: 800 },
  { month: "Feb", revenue: 1200, expenses: 900 }
]

// Inferred config
{
  xAxis: "month",
  yAxis: ["revenue", "expenses"],
  xLabel: "Month",
  yLabel: "Amount",
  series: ["Revenue", "Expenses"]
}
```

### Maps (GeoJSON)

**Map Type Selection** (Claude determines through conversation):
- **Locator map** (`locator-map`): User wants to show specific locations
- **Symbol map** (`d3-maps-symbols`): User wants to visualize numeric data at point locations
- **Choropleth map** (`d3-maps-choropleth`): User wants to compare data across regions

**Validation**:
- Check for `type: "FeatureCollection"` with `features` array
- Validate `geometry` objects in features
- Require `map_type` parameter

**Configuration**:
- **Bounds**: Calculated dynamically from GeoJSON coordinates (min/max lat/lon)
- **View**: Center and zoom set based on calculated bounding box
- **Properties**: Stripped to essential data only (name + numeric values) to reduce token usage
- **Markers**: Point geometries rendered as markers (locator/symbol maps)
- **Polygons**: Rendered as colored regions (choropleth maps)
- **Tooltips**: Use `properties` object for popup content

**Example**:
```javascript
// User: "Show me parking locations with number of spaces"
// Claude asks: "Do you want to see the locations, or visualize the space counts?"
// User: "Visualize the counts"
// Claude determines: map_type = "d3-maps-symbols"

// Input GeoJSON:
{
  type: "FeatureCollection",
  features: [
    {
      geometry: { type: "Point", coordinates: [13.4, 52.5] },
      properties: { name: "Parking A", spaces: 50 }
    }
  ]
}

// Stripped GeoJSON (sent to Datawrapper):
{
  type: "FeatureCollection",
  features: [
    {
      geometry: { type: "Point", coordinates: [13.4, 52.5] },
      properties: { name: "Parking A", spaces: 50 }  // Keeps name + numeric properties
    }
  ]
}
```

---

## Data Validation

### General Rules
- **Minimum rows**: 1 row for charts, 1 feature for maps
- **Maximum rows**: 10,000 (Datawrapper API limit)
- **Empty data**: Return error with clear message
- **Invalid chart type**: Return error listing valid types

### Bar & Line Charts
- **Required**: At least one numeric column
- **Warning**: If >20 categories, suggest grouping or filtering
- **Error**: All columns are strings (no numeric data)

### Maps
- **Required**: Valid GeoJSON structure
- **Validation**: Each feature must have `geometry` object
- **Warning**: Features outside Berlin bounds

---

## Integration

### With berlin-open-data-mcp

**Workflow in interface-prototype**:
1. User: "Show parking data and create a map"
2. Claude calls `search_datasets` (berlin-open-data-mcp)
3. Claude calls `fetch_dataset_data` (berlin-open-data-mcp) → JSON data
4. Claude calls `create_visualization` (datawrapper-mcp) → passes data
5. Chart renders inline in chat

**Data Flow**:
```
berlin-open-data-mcp → fetch WFS as GeoJSON
                    ↓
                JSON data with WGS84 coordinates
                    ↓
datawrapper-mcp → create map visualization
                    ↓
                Embedded iframe + URLs
```

### In Claude Desktop

**Configuration** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "berlin-data": {
      "command": "node",
      "args": ["/path/to/berlin-open-data-mcp/dist/index.js"]
    },
    "datawrapper": {
      "command": "node",
      "args": ["/path/to/datawrapper-mcp/dist/index.js"],
      "env": {
        "DATAWRAPPER_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

### In interface-prototype

**Backend Changes** (`backend/src/server.ts`):
```typescript
// Add second MCP client
const datawrapperClient = new MCPClientManager({
  serverPath: path.resolve(__dirname, '../../../datawrapper-mcp/dist/index.js')
});

await datawrapperClient.connect();

// Pass both clients to WebSocketHandler
const wsHandler = new WebSocketHandler(berlinMcpClient, claudeClient, datawrapperClient);
```

**Frontend Changes** (`frontend/src/lib/Message.svelte`):
- Handle `[CHART:...]` markers similar to `[DOWNLOAD:...]`
- Extract iframe and render inline
- Show URLs below chart for reference

---

## Configuration & Setup

### Environment Variables

```bash
# Required
DATAWRAPPER_API_TOKEN=your_datawrapper_api_token

# Optional
CHART_LOG_PATH=./charts-log.json  # Default: ./charts-log.json
```

### Getting a Datawrapper API Token

1. Create account at https://app.datawrapper.de/
2. Navigate to Settings → API Tokens
3. Create new token with permissions: `chart:read`, `chart:write`, `chart:publish`
4. Copy token to `.env` file

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Error Handling

### API Errors

**Authentication failure**:
```
❌ Datawrapper authentication failed. Please check your API token.
```

**Rate limiting**:
```
❌ Rate limit exceeded. Please try again in a few moments.
```

**Invalid data**:
```
❌ Cannot create bar chart: No numeric columns found in data.
Data must contain at least one numeric column for visualization.
```

**Chart creation failure**:
```
❌ Failed to create chart: {error_message}
Please try again or check the data format.
```

### Data Validation Errors

**Empty data**:
```
❌ Cannot create visualization: Data array is empty.
Please provide at least one row of data.
```

**Too many rows**:
```
❌ Data exceeds Datawrapper limit of 10,000 rows (provided: 15,000).
Please filter or aggregate the data before visualization.
```

**Invalid GeoJSON**:
```
❌ Invalid GeoJSON: Missing 'features' array.
Maps require GeoJSON FeatureCollection format.
```

---

## Testing Strategy

### Unit Tests

**Chart Builder**:
- Title generation from different data structures
- Axis detection with various column types
- GeoJSON validation and processing
- Data formatting for Datawrapper API

**Data Validation**:
- Empty data handling
- Row limit enforcement
- Column type detection
- GeoJSON structure validation

### Integration Tests

**Datawrapper API**:
- Chart creation (mock API or test account)
- Data upload with different formats
- Publishing workflow
- Error handling (invalid tokens, rate limits)

### End-to-End Tests

**Test Cases**:
1. **Bar chart**: Vornamen dataset by district
   - Fetch data from berlin-open-data-mcp
   - Create bar chart comparing districts
   - Verify chart renders with correct labels

2. **Line chart**: Steuereinnahmen monthly trends
   - Fetch time-series data
   - Create line chart showing trends
   - Verify date formatting and axis labels

3. **Map**: Parkplätze WFS data
   - Fetch GeoJSON from berlin-open-data-mcp
   - Create map visualization
   - Verify markers/polygons render correctly

---

## Future Enhancements

### Phase 2: Chart Management
- `update_chart(chartId, newData)`: Update existing charts
- `delete_chart(chartId)`: Delete charts
- `list_charts()`: View all created charts

### Phase 3: Advanced Customization
- Color scheme selection
- Font customization
- Annotation support (markers, text labels)
- Chart templates/presets

### Phase 4: Additional Chart Types
- Pie charts
- Scatter plots
- Area charts
- Stacked bar charts
- Grouped bar charts

### Phase 5: Advanced Maps
- Address geocoding
- Multiple layers
- Custom basemaps
- Interactive filters

---

## Project Structure

```
datawrapper-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── datawrapper-client.ts    # Datawrapper API wrapper
│   ├── chart-builder.ts         # Smart defaults engine
│   ├── chart-logger.ts          # JSON log management
│   ├── types.ts                 # TypeScript interfaces
│   └── utils.ts                 # Helper functions
├── dist/                        # Compiled JavaScript
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   └── plans/
│       ├── design-spec.md       # This document
│       └── implementation-plan.md   # Detailed implementation guide
├── charts-log.json              # Created charts log
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Success Metrics

### MVP Completion Criteria
- ✅ All 3 chart types working (bar, line, map)
- ✅ Smart defaults generate sensible visualizations
- ✅ Charts render in Claude Desktop
- ✅ Integration with interface-prototype complete
- ✅ Chart logging tracks provenance
- ✅ 3+ real Berlin dataset examples documented

### Quality Metrics
- API calls succeed >95% of time
- Charts generated in <5 seconds
- Smart defaults produce usable charts without manual intervention in >90% of cases
- GeoJSON maps render correctly for all Berlin WFS datasets

---

## Timeline Estimate

- **Phase 1** (Core Infrastructure): 2-3 days
- **Phase 2** (Chart Types): 3-4 days
- **Phase 3** (Integration): 2-3 days
- **Testing & Documentation**: 2 days

**Total**: ~10-12 days for MVP

---

*Last Updated: December 2025*
