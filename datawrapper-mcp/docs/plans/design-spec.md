# Datawrapper MCP Server - Design Specification

## Overview

The Datawrapper MCP server enables automatic visualization of Berlin open data by integrating with the Datawrapper API. It serves as a complementary tool to the berlin-open-data-mcp server, completing the data exploration workflow: search → fetch → analyze → **visualize**.

### Use Cases

1. **Standalone in Claude Desktop**: Users can create charts directly through Claude Desktop by providing data. Charts render inline as embedded iframes.
2. **Integrated Pipeline**: Works seamlessly with berlin-open-data-mcp in the interface-prototype, enabling conversational data visualization.

### Supported Chart Types

**Bar Charts** (horizontal):
- Basic bar (`d3-bars`)
- Stacked bar (`d3-bars-stacked`)
- Split bar (`d3-bars-split`)

**Column Charts** (vertical):
- Basic column (`column-chart`)
- Grouped column (`grouped-column-chart`)
- Stacked column (`stacked-column-chart`)

**Line & Area**:
- Line chart (`d3-lines`)
- Area chart (`d3-area`)

**Distribution/Comparison**:
- Scatter plot (`d3-scatter-plot`)
- Dot plot (`d3-dot-plot`)
- Range plot (`d3-range-plot`)
- Arrow plot (`d3-arrow-plot`)

**Part-to-Whole**:
- Pie chart (`d3-pies`)
- Donut chart (`d3-donuts`)
- Election donut (`election-donut-chart`)

**Data Display**:
- Table (`tables`)

**Maps**:
- Symbol map (`d3-maps-symbols`)
- Choropleth map (`d3-maps-choropleth`)

**Key Features**:
- Direct JSON data input (array of objects)
- Automatic smart defaults (titles, labels, colors inferred from data)
- GeoJSON support for maps (aligning with berlin-open-data-mcp WFS output)
- Automatic chart publishing (all charts publicly accessible)
- Simple provenance tracking (JSON log with source dataset links)
- Strict data validation with clear error messages

**Out of Scope**:
- Chart editing/updating after creation
- Chart deletion
- Manual styling/customization
- Non-GeoJSON map formats
- Private/draft charts
- Bullet bars
- Multiple pies/donuts

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
    chartType: string;  // Datawrapper type string
    variant?: string;   // For bar/column variants
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
  chart_type: 'bar' | 'column' | 'line' | 'area' | 'scatter' | 'dot' | 'range' | 'arrow' | 'pie' | 'donut' | 'election-donut' | 'table' | 'map';
  variant?: 'basic' | 'stacked' | 'grouped' | 'split';  // For bar/column charts
  map_type?: 'd3-maps-symbols' | 'd3-maps-choropleth'; // Required when chart_type is 'map'
  title?: string;                              // Optional: Chart title (auto-generated if omitted)
  description?: string;                        // Optional: Chart description/byline
  source_dataset_id?: string;                  // Optional: Berlin dataset ID for tracking
}
```

**Variant Options**:
- `bar`: basic (default), stacked, split
- `column`: basic (default), grouped, stacked

**Map Types** (when `chart_type` is "map"):
- `d3-maps-symbols`: Show point locations on a map (works with or without numeric data for marker sizing)
- `d3-maps-choropleth`: Compare data across regions with color fills (e.g., "show population density by district")

**Datawrapper Type Mapping**:

| chart_type | variant | Datawrapper type |
|------------|---------|------------------|
| `bar` | basic | `d3-bars` |
| `bar` | stacked | `d3-bars-stacked` |
| `bar` | split | `d3-bars-split` |
| `column` | basic | `column-chart` |
| `column` | grouped | `grouped-column-chart` |
| `column` | stacked | `stacked-column-chart` |
| `line` | - | `d3-lines` |
| `area` | - | `d3-area` |
| `scatter` | - | `d3-scatter-plot` |
| `dot` | - | `d3-dot-plot` |
| `range` | - | `d3-range-plot` |
| `arrow` | - | `d3-arrow-plot` |
| `pie` | - | `d3-pies` |
| `donut` | - | `d3-donuts` |
| `election-donut` | - | `election-donut-chart` |
| `table` | - | `tables` |
| `map` | symbols | `d3-maps-symbols` |
| `map` | choropleth | `d3-maps-choropleth` |

**Note on Locator Maps**: Datawrapper's `locator-map` type is not currently supported because it requires a different data format (markers array instead of GeoJSON). For showing point locations, use `d3-maps-symbols` which accepts GeoJSON and serves the same purpose. See "Future Enhancements" section for details on implementing locator-map support if needed.

**Example Usage**:
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
    { year: "2020", male: 1800000, female: 1900000 },
    { year: "2021", male: 1820000, female: 1910000 }
  ],
  chart_type: "column",
  variant: "stacked",
  title: "Population by Gender"
}

// Scatter plot
{
  data: [
    { income: 35000, rent: 800 },
    { income: 45000, rent: 1100 },
    { income: 55000, rent: 1400 }
  ],
  chart_type: "scatter",
  title: "Income vs Rent"
}

// Pie chart
{
  data: [
    { party: "SPD", seats: 36 },
    { party: "CDU", seats: 30 },
    { party: "Grüne", seats: 32 }
  ],
  chart_type: "pie",
  title: "Berlin Parliament 2021"
}

// Symbol map
{
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [13.4, 52.5] },
        properties: { name: "Christmas Market A", visitors: 100 }
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
1. Claude analyzes data structure + user intent
2. Claude recommends chart type with reasoning
3. User confirms or adjusts
4. Tool validates strictly - if data doesn't match, Claude uses `execute_code` to reshape it
5. Apply smart defaults (title, axes, labels, bounding box)
6. Create chart via Datawrapper API
7. Upload formatted data (with stripped GeoJSON properties for maps)
8. Publish chart publicly
9. Log to charts-log.json
10. Return iframe embed + URLs + sample feature (for maps)

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

### Data Requirements by Chart Type

Each chart type has specific data requirements. The tool validates strictly and returns clear errors if requirements aren't met.

**Bar/Column Charts**:
- `basic`: 1 categorical column + 1+ numeric columns
- `stacked/grouped`: 1 categorical column + 2+ numeric columns (or 1 numeric + 1 grouping column)
- `split`: 1 categorical column + 2 numeric columns (one per side)

**Line/Area Charts**:
- 1 categorical/date column + 1+ numeric columns

**Scatter Plot**:
- 2 numeric columns (x, y)
- Optional: categorical column for color grouping, numeric column for size

**Dot Plot**:
- 1 categorical column + 1 numeric column

**Range Plot**:
- 1 categorical column + 2 numeric columns (start, end values)

**Arrow Plot**:
- 1 categorical column + 2 numeric columns (from, to values)

**Pie/Donut**:
- 1 categorical column (labels) + 1 numeric column (values)

**Election Donut**:
- 1 categorical column (party names) + 1 numeric column (votes/seats)

**Table**:
- Any columns - renders as-is

### Bar, Column, Line & Area Charts

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
- **Symbol map** (`d3-maps-symbols`): User wants to show point locations (with or without numeric data visualization)
- **Choropleth map** (`d3-maps-choropleth`): User wants to compare data across regions with color fills

**Validation**:
- Check for `type: "FeatureCollection"` with `features` array
- Validate `geometry` objects in features
- Require `map_type` parameter

**Configuration**:
- **Bounds**: Calculated dynamically from GeoJSON coordinates (min/max lat/lon)
- **View**: Center and zoom set based on calculated bounding box
- **Properties**: Stripped to essential data only (name + numeric values) to reduce token usage
- **Markers**: Point geometries rendered as markers (symbol maps)
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

### Validation Error Messages

When data doesn't match chart type requirements, the tool returns clear errors that help Claude know what to fix via `execute_code`.

**Examples**:

```
❌ Cannot create scatter plot: Requires at least 2 numeric columns.
Found: 1 numeric column (population), 2 string columns (district, name).
Hint: Need two numeric columns for x and y axes.
```

```
❌ Cannot create range plot: Requires exactly 2 numeric columns for start/end values.
Found: 1 numeric column (value).
Hint: Data should have columns like [category, start_value, end_value].
```

```
❌ Cannot create pie chart: Requires 1 categorical + 1 numeric column.
Found: 3 numeric columns (revenue, expenses, profit).
Hint: Aggregate or select one numeric column for the values.
```

```
❌ Cannot create stacked bar: Requires 2+ numeric columns or a grouping column.
Found: 1 categorical column (district), 1 numeric column (count).
Hint: Add more numeric columns, or restructure data with a grouping column.
```

### Bar & Column Charts
- **Required**: At least one numeric column
- **Warning**: If >20 categories, suggest grouping or filtering
- **Error**: All columns are strings (no numeric data)
- **Variant validation**: stacked/grouped requires 2+ numeric columns

### Scatter Plot
- **Required**: At least 2 numeric columns
- **Error**: Less than 2 numeric columns found

### Range & Arrow Plots
- **Required**: Exactly 2 numeric columns (start/end or from/to)
- **Error**: Wrong number of numeric columns

### Pie, Donut & Election Donut
- **Required**: Exactly 1 categorical + 1 numeric column
- **Error**: Multiple numeric columns (suggest aggregation)

### Table
- **No validation**: Any data structure accepted

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

### Phase 4: Advanced Maps
- Address geocoding
- Multiple layers
- Custom basemaps
- Interactive filters

### Phase 5: Locator Map Support

**Why Not Currently Supported**:
Datawrapper's `locator-map` type requires a different data format than symbol and choropleth maps:
- **Symbol/Choropleth maps**: Accept GeoJSON via `/charts/{id}/data` endpoint
- **Locator maps**: Require custom `markers` array format, not GeoJSON

**Current Workaround**:
Use `d3-maps-symbols` for showing point locations - it works with GeoJSON and serves the same basic purpose.

**How to Implement** (if needed in future):

1. **Add GeoJSON to Markers Conversion** in `chart-builder.ts`:
```typescript
convertGeoJSONToMarkers(geojson: GeoJSON): { markers: Array<any> } {
  const markers = geojson.features.map(feature => {
    const [lon, lat] = feature.geometry.coordinates;
    return {
      type: 'point',
      title: feature.properties?.name || 'Location',
      coordinates: [lon, lat],
      tooltip: { text: feature.properties?.name || '' },
      markerColor: '#2A7FFF'
    };
  });
  return { markers };
}
```

2. **Handle Locator Maps Differently** in `index.ts`:
```typescript
if (map_type === 'locator-map') {
  const markersData = chartBuilder.convertGeoJSONToMarkers(geojson);
  dataString = JSON.stringify(markersData);
} else {
  // Symbol and choropleth use GeoJSON
  dataString = chartBuilder.processGeoJSON(strippedGeoJSON);
}
```

3. **Update Type Definitions** in `types.ts`:
```typescript
export type MapType = 'locator-map' | 'd3-maps-symbols' | 'd3-maps-choropleth';
```

4. **Update Tool Schema** to include `'locator-map'` in enum

**References**:
- [Datawrapper: Adding Point Markers](https://developer.datawrapper.de/docs/adding-markers)
- [Datawrapper: Creating a Locator Map](https://developer.datawrapper.de/docs/creating-a-locator-map)

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

### Completion Criteria
- ✅ All chart types working (bar, column, line, area, scatter, dot, range, arrow, pie, donut, election-donut, table, map)
- ✅ All variants working (basic, stacked, grouped, split)
- ✅ Smart defaults generate sensible visualizations
- ✅ Charts render in Claude Desktop
- ✅ Integration with interface-prototype complete
- ✅ Chart logging tracks provenance
- ✅ Strict validation with clear error messages

### Quality Metrics
- API calls succeed >95% of time
- Charts generated in <5 seconds
- Smart defaults produce usable charts without manual intervention in >90% of cases
- GeoJSON maps render correctly for all Berlin WFS datasets
- Validation errors provide actionable hints for data reshaping

---

## Implementation Scope

### Files to Modify

1. **`src/index.ts`** - Update tool schema with new chart types and variants, add type mapping logic

2. **`src/chart-builder.ts`** - Add validation and smart defaults for each chart type:
   - `inferChartConfig()` - extend for scatter, dot, range, arrow, pie, donut, election-donut, table
   - `validateDataForChartType()` - strict validation with clear error messages
   - `formatForDatawrapper()` - extend for new chart types if needed

3. **`src/types.ts`** - Update TypeScript interfaces for new chart types and variants

### No Changes Needed

- `src/datawrapper-client.ts` - already generic (creates any chart type)
- `src/chart-logger.ts` - already logs any chart type

---

*Last Updated: December 2025*
