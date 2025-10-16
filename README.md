# Berlin Open Data MCP Server

A Model Context Protocol (MCP) server for natural language discovery of Berlin's open datasets.

## Features

- 🔍 **Natural Language Search**: Query datasets using plain English (e.g., "Find datasets about bicycle infrastructure")
- 📊 **Dataset Discovery**: Browse available datasets, categories, and organizations
- 🏷️ **Smart Categorization**: Automatically maps queries to relevant tags and categories
- 🔗 **Direct API Integration**: Connects to Berlin's official CKAN-based data portal

## Installation

```bash
npm install
npm run build
```

## Usage

The server implements the MCP protocol and provides these tools:

### Tools

1. **search_berlin_datasets**: Search datasets using natural language
2. **get_dataset_details**: Get detailed information about a specific dataset
3. **list_dataset_categories**: Browse available categories and organizations
4. **autocomplete_datasets**: Get dataset suggestions for partial queries

### Example Queries

- "Find all datasets about bicycle infrastructure in Berlin"
- "Show me traffic data for Berlin districts"
- "What datasets are available about air quality?"
- "List all housing and rental data"

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