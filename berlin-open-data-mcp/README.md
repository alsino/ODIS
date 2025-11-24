# Berlin Open Data MCP Server

A Model Context Protocol (MCP) server for natural language discovery of Berlin's open datasets.

## Features

- 🔍 **Natural Language Search**: Query datasets using plain English
- 📊 **Dataset Discovery**: Browse datasets by category, organization, or explore all available data
- 📈 **Portal Overview**: Get statistics and understand the data landscape
- 💾 **Data Fetching**: Download and parse dataset contents (CSV, JSON, Excel, GeoJSON, KML)
- 📑 **Excel Support**: Automatically parses XLS and XLSX files (545 datasets, 20.6% of portal)
- 🗺️ **Geodata Support**: Parse GeoJSON and KML geospatial formats (78 datasets, 3.0% of portal)
  - Automatic feature-to-table conversion
  - Geometry metadata extraction (type, coordinates)
  - Works with JSON-tagged GeoJSON files
- 🌐 **Browser Automation**: Optional Puppeteer support for JavaScript-rendered downloads (182 datasets, 6.9% of portal)
- 🎯 **Smart Sampling**: Automatic data sampling with statistics to prevent context overflow
- 🔗 **Direct API Integration**: Connects to Berlin's official CKAN-based data portal
- 🤖 **Agentic Workflows**: Tools can be chained together for complex analysis tasks

**Total Portal Coverage**: 1,113 datasets (41.9% of portal)

## Installation

```bash
npm install
npm run build
```

### Optional: Browser Automation Support

To enable fetching of datasets from statistik-berlin-brandenburg.de (182 datasets, ~7% of portal), install Puppeteer:

```bash
npm install puppeteer
```

This adds ~300MB of dependencies (Chromium) but unlocks access to demographic and statistical datasets that require JavaScript to download.

## Usage

The server implements the MCP protocol and provides these tools:

### Tools

**Portal Metadata & Navigation:**

1. **get_portal_stats**: Get overview statistics (total datasets, organizations, categories)
2. **list_all_datasets**: Browse all datasets with pagination

**Dataset Discovery:**

3. **search_berlin_datasets**: Search datasets using natural language
4. **get_dataset_details**: Get detailed information about a specific dataset (includes resource IDs for downloading)

**Data Fetching & Analysis:**

5. **fetch_dataset_data**: View dataset contents in chat for analysis (returns sample/preview)
6. **download_dataset**: Download dataset as a file to user's computer (triggers browser download)

### Example Queries

- "Find all datasets about bicycle infrastructure in Berlin"
- "Show me traffic data for Berlin districts"
- "What datasets are available about air quality?"
- "List all housing and rental data"

### Workflow Examples

**Explore the portal:**
```
User: "What's available in the Berlin Open Data Portal?"
→ Uses get_portal_stats
→ Gets overview with counts and suggestions
```

**Find and analyze data:**
```
User: "Which Berlin district has the most green space per capita?"
→ Uses search_berlin_datasets for green space data
→ Uses fetch_dataset_data to view the data in chat
→ Performs calculation using fetched data
→ Returns answer with methodology
```

**Download data for local use:**
```
User: "Lade die Zugriffsstatistik herunter" / "Download the traffic data"
→ Uses search_berlin_datasets to find dataset
→ Uses download_dataset to trigger browser download
→ User saves file locally with browser download dialog
```

**Multi-dataset analysis:**
```
User: "Is there correlation between air quality and traffic?"
→ Searches for air quality datasets
→ Searches for traffic datasets
→ Fetches both datasets
→ Analyzes correlation
→ Returns findings
```

### Running the Server

```bash
npm start
```

The server communicates via stdio following the MCP protocol.

## Geodata Support

The server automatically handles geospatial data formats, converting them to tabular format for easy analysis:

**Supported Formats:**
- **GeoJSON**: JSON-based vector data (may be tagged as JSON, GeoJSON, or GEOJSON-Datei)
- **KML**: Keyhole Markup Language from Google Earth

**How It Works:**
- Each geographic feature becomes a table row
- Feature properties become regular columns
- Geometry is stored in special columns:
  - `geometry_type`: Type of geometry (Point, LineString, Polygon, etc.)
  - `geometry_coordinates`: Coordinate array as JSON string
  - `feature_id`: Feature identifier (if present)

**Example:**

A GeoJSON with drinking fountains:
```json
{
  "type": "Feature",
  "geometry": {"type": "Point", "coordinates": [13.4, 52.5]},
  "properties": {"name": "Trinkbrunnen", "category": "public"}
}
```

Becomes a table row:
```
name: "Trinkbrunnen"
category: "public"
geometry_type: "Point"
geometry_coordinates: "[13.4, 52.5]"
```

This enables standard data analysis operations on geospatial datasets.

## Query Processing

The server uses a **three-tier search strategy** for optimal relevance:

1. **Expansion Search** - Broad coverage using portal metadata mappings
   - Expands query terms (e.g., "Einwohner" → "Einwohnerinnen", "Kleinräumige einwohnerzahl")
   - Handles German and English keywords
   - Ensures high recall (finds all relevant datasets)

2. **Smart Fallback Detection** - Precision checking
   - Checks if top 5 expansion results contain all user's key terms
   - Triggers literal search if exact match not found

3. **Literal Search + Year Boosting** - Exact match prioritization
   - Runs CKAN literal search when needed
   - Position-based scoring (1st result = highest score)
   - **+1000 bonus for datasets containing query year** (e.g., "2024")
   - Ensures specific queries return exact matches first

**Result**: Broad coverage with precise ranking. Queries like "Einwohner 2024" return the 2024 dataset first, not older alternatives.

## API Integration

Connects to Berlin's open data portal at `daten.berlin.de` using the CKAN API:
- Package search and filtering
- Dataset metadata retrieval
- Tag and organization browsing
- Autocomplete functionality

## Development

```bash
npm run dev  # Development mode with tsx
npm run build  # Production build
```

## Documentation

- [Claude Desktop Setup Guide](docs/CLAUDE_DESKTOP_SETUP.md)
- [Conversational AI Workflow](docs/CONVERSATIONAL_AI_WORKFLOW.md)
- [MCP Innovation Ideas](docs/MCP_INNOVATION_IDEAS.md)
- [Usage Examples](docs/USAGE.md)