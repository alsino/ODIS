# Berlin Open Data MCP Server

A Model Context Protocol (MCP) server for natural language discovery of Berlin's open datasets.

## Features

- 🔍 **Natural Language Search**: Query datasets using plain English
- 📊 **Dataset Discovery**: Browse datasets by category, organization, or explore all available data
- 📈 **Portal Overview**: Get statistics and understand the data landscape
- 💾 **Data Fetching**: Download and parse dataset contents (CSV, JSON, Excel)
- 📑 **Excel Support**: Automatically parses XLS and XLSX files (545 datasets, 20.6% of portal)
- 🌐 **Browser Automation**: Optional Puppeteer support for JavaScript-rendered downloads (182 datasets, 6.9% of portal)
- 🎯 **Smart Sampling**: Automatic data sampling with statistics to prevent context overflow
- 🔗 **Direct API Integration**: Connects to Berlin's official CKAN-based data portal
- 🤖 **Agentic Workflows**: Tools can be chained together for complex analysis tasks

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
4. **get_dataset_details**: Get detailed information about a specific dataset

**Data Fetching & Analysis:**
5. **list_dataset_resources**: Show all available files for a dataset
6. **fetch_dataset_data**: Download and parse dataset contents with smart sampling

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
→ Uses fetch_dataset_data to get the actual data
→ Performs calculation using fetched data
→ Returns answer with methodology
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

## Query Processing

The server includes intelligent query processing that:
- Maps natural language to relevant search terms
- Identifies categories (traffic, environment, housing, etc.)
- Handles German and English keywords
- Provides structured search results with summaries

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