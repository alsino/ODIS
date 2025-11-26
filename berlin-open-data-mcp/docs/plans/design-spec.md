# Berlin Open Data MCP Server - Design Specification

## Document Overview

This document captures the complete design specification for the enhanced Berlin Open Data MCP server, including system goals, architecture decisions, tool design, and implementation strategy.

---

## Section 1: System Overview & Goals

### What We're Building

A Berlin Open Data MCP server that extends the current search-focused prototype into an analysis and workflow tool. The server enables conversational data discovery, fetching, analysis, and eventually visualization through an agentic, tool-chaining approach.

### Core Philosophy

**Hybrid processing model**: Server handles Berlin-specific data operations (fetching, basic transformations, sampling), while the LLM orchestrates workflows and performs reasoning/analysis

**Transparent tool chaining**: Each operation is a separate tool that Claude can chain together, making the process observable and debuggable rather than black-box

**Incremental complexity**: Start with core CSV/JSON data fetching and basic operations, then add capabilities (GeoJSON, visualization, query filtering) as actual usage patterns emerge

**Single data source focus**: Built exclusively for Berlin Open Data Portal (daten.berlin.de) - no premature abstraction for other sources

### Target Users

Citizens and city administration staff who want to ask questions like "Which district has the most green space per capita?" or "Is there correlation between air quality and traffic?" without needing to manually wrangle data.

### Key Capabilities

1. **Portal metadata & navigation** - Browse the entire catalog: list all datasets, view statistics (datasets per topic/organization), understand portal structure without searching

2. **Dataset discovery** - Search and get suggestions based on topics/research needs

3. **Data fetching & sampling** - Retrieve actual data with smart sampling to avoid context limits

4. **Analysis support** - Enable LLM to perform correlations, aggregations, and answer analytical questions

5. **Workflow automation** - Chain operations together (search → fetch → analyze) autonomously

### Success Criteria

The system should handle both exploratory ("What data exists about traffic?") and analytical ("Which district has most green space?") workflows autonomously - from understanding the portal landscape, to finding relevant datasets, to fetching and enabling analysis.

---

## Section 2: Tool Architecture

### Tool Design Principles

- Each tool performs one clear operation (search, fetch, list, analyze)
- Tools return structured, LLM-friendly text responses (markdown formatted)
- Tools handle errors gracefully and suggest next steps
- Smart defaults (limits, sampling) to prevent overwhelming responses

### Proposed Tool Set

#### Category 1: Portal Metadata & Navigation

**`get_portal_stats`**
- Returns overview: total datasets, number of organizations, top categories, last updated
- No parameters required
- Use case: "What's in the Berlin Open Data Portal?"

**`list_all_datasets`**
- Paginated listing of all datasets with offset/limit parameters (default: 100 per page)
- Parameters: offset (default: 0), limit (default: 100)
- Use case: "Show me all datasets" or browsing the entire catalog

#### Category 2: Dataset Discovery (existing, may need updates)

**`search_berlin_datasets`**
- Natural language search with pagination support
- Parameters: query (required), limit (default: 20)
- Use case: "Find datasets about bicycles"

**`get_dataset_details`**
- Full metadata for specific dataset including resource IDs for downloading
- Parameters: dataset_id (required)
- Returns: Description, tags, license, author, maintainer, and all resources with IDs
- Use case: "Tell me more about dataset xyz"

#### Category 3: Data Fetching & Processing (new)

**`fetch_dataset_data`**
- Fetch actual data from a dataset resource with automatic format handling (CSV/JSON → tabular)
- Returns: Minimal preview (first 10 rows) + basic column info (names and types only)
- Parameters:
  - dataset_id (required)
  - resource_id (optional - picks first if not specified, get from get_dataset_details)
  - full_data flag (default: false) - returns all data for small datasets (≤500 rows), refuses for large datasets
- Use case: "Get me the bicycle parking data"

**`download_dataset`**
- Download a dataset as a file to user's computer (triggers browser download dialog)
- Returns: File content with special download marker for browser
- Parameters:
  - dataset_id (required)
  - resource_id (optional - picks first data resource if not specified)
  - format (optional) - "csv" or "json", defaults to resource format
- Use case: "Download the traffic data" or "Lade die Zugriffsstatistik herunter"
- Note: Distinct from fetch_dataset_data which displays data in chat

#### Category 4: Analysis Support (future - add as patterns emerge)

- Basic aggregation tools
- Simple filtering/joining capabilities
- Statistical summary functions

### Return Format Philosophy

All tools return markdown-formatted text optimized for LLM consumption, including:
- Clear section headers
- Structured data presentation (tables where appropriate)
- Actionable "Next steps" suggestions
- Links/references to related tools

---

## Section 3: Data Fetching & Processing Strategy

### Minimal Preview Approach

When `fetch_dataset_data` is called, the server will:

1. Download the resource (CSV, JSON, or other tabular format)
2. Parse and normalize to tabular structure
3. Generate minimal metadata:
   - Total row count
   - Column names and inferred data types (number, string, boolean, date, unknown)
4. Return first 10 rows as preview
5. For small datasets (≤500 rows), allow full_data flag to return everything
6. For large datasets (>500 rows), refuse full_data and suggest manual download

### Format Handling

**CSV**: Parse directly, handle common encoding issues (UTF-8, Latin-1)

**JSON**: Detect structure (array of objects, nested), flatten to tabular if possible

**Excel/XLS**: Convert to CSV-like structure (requires library like xlsx) - deferred for now

**Other formats**: Return metadata with download URL, graceful error message

**GeoJSON**: Deferred to future phase - will require spatial data handling

### Why This Approach

- Minimal token usage for initial preview (10 rows vs. 100)
- Clear threshold (500 rows) separates "analyzable in context" from "download required"
- Forces explicit decision: analyze small data in-context or download large data for file attachment
- Prevents accidental context overflow from datasets with thousands of rows
- Guides users toward Claude Desktop's file attachment feature for large datasets

### Automatic Format Conversion

The system uses automatic, opinionated conversion:
- Tool detects source format automatically
- Converts everything to a standard tabular format (array of objects)
- User doesn't need to think about formats
- Can add explicit conversion tool later if users request it

### Caching Considerations

For now, no caching - fetch fresh each time. Can add later if performance becomes an issue.

### Error Handling

- Invalid dataset/resource IDs → suggest using search tools
- Format parsing failures → return raw data with warning
- Download failures → return error with portal URL for manual inspection
- Timeout errors → suggest trying smaller resource or different format
- Large file warnings → inform about size limits

---

## Section 4: API Integration & Implementation

### Berlin Open Data Portal API (CKAN)

The existing code already integrates with the CKAN API at `daten.berlin.de`. We'll extend this with:

#### New API Endpoints to Use

**`package_list`** - Get all dataset IDs (for list_all_datasets)

**`package_search` with `rows` parameter** - Support pagination (already partially implemented)

**`group_list` + `group_package_show`** - List datasets by category

**`organization_list` + `organization_package_show`** - List by organization

**`package_show`** - Get full dataset details including resource URLs (already implemented)

**`status_show`** - Portal statistics and metadata

### Resource Data Fetching

- Resources have direct download URLs in their metadata
- Use standard HTTP fetch (axios/node-fetch) to download
- Parse based on `format` field in resource metadata
- Handle common issues: redirects, authentication (shouldn't be needed), timeouts

### Code Organization

**`berlin-api.ts`** - Extend existing BerlinOpenDataAPI class with new methods for listing, counting, stats

**`data-fetcher.ts`** - New module for downloading and parsing resource data

**`data-sampler.ts`** - New module for smart sampling and summary statistics

**`index.ts`** - Add new tool handlers (similar to existing structure)

**`types.ts`** - Extend with new type definitions for resources, samples, stats

### Dependencies to Add

- CSV parsing library (e.g., `csv-parse` or `papaparse`)
- Possibly `xlsx` for Excel support (can defer)
- Type definitions as needed

---

## Section 5: Agentic Workflow Examples

### How Tool Chaining Works in Practice

#### Example 1: Simple Exploration

```
User: "What datasets exist about air quality?"
→ Claude calls: search_berlin_datasets("air quality")
→ Returns: List of 5 relevant datasets
→ Claude responds with summary
```

#### Example 2: Portal Overview

```
User: "Give me an overview of what data is available"
→ Claude calls: get_portal_stats()
→ Returns: Total datasets, top categories, organizations
→ Claude responds with formatted overview

User: "Show me all environmental datasets"
→ Claude calls: search_berlin_datasets("environment")
→ Returns: Comprehensive list of environment-related datasets
```

#### Example 3: Multi-Step Analysis

```
User: "Which district has the most green space per capita?"
→ Claude calls: search_berlin_datasets("green space area")
→ Identifies dataset, notes resource format
→ Claude calls: fetch_dataset_data(dataset_id, resource_id)
→ Returns: Sample data + summary showing columns
→ Claude calls: search_berlin_datasets("population by district")
→ Identifies population dataset
→ Claude calls: fetch_dataset_data(dataset_id_2, resource_id_2)
→ Returns: Sample data
→ Claude performs calculation using both datasets
→ Claude responds with answer + methodology
```

#### Example 4: Complex Correlation (Original Example)

```
User: "Is there correlation between air quality and green spaces?"
→ Claude calls: search_berlin_datasets("air quality")
→ Claude calls: get_dataset_details() for promising result
→ Claude calls: fetch_dataset_data() for air quality measurements
→ Claude calls: search_berlin_datasets("green space")
→ Claude calls: fetch_dataset_data() for green space data
→ Claude analyzes both datasets (joins by district, calculates correlation)
→ Claude responds with findings and suggests visualization
```

### Key Insight

Each tool call returns information that helps Claude decide the next step. The transparency means users can see the reasoning chain, and developers can debug where things go wrong.

---

## Section 6: Implementation Plan & Priorities

### Phase 1: Portal Metadata & Navigation (Foundation)

**Goal**: Enable users to understand the overall landscape of available datasets without searching.

**Tasks**:
1. Extend `berlin-api.ts` with new CKAN endpoints:
   - `getPortalStats()`
   - `listAllDatasets(offset, limit)`
   - `listDatasetsByCategory(category, offset, limit)`
   - `listDatasetsByOrganization(org, offset, limit)`
   - `countDatasets(filters)`
2. Add corresponding MCP tools in `index.ts`
3. Test with real portal to verify pagination works correctly

**Deliverables**:
- 5 new API methods
- 5 new MCP tools
- Updated type definitions
- Tests confirming functionality

### Phase 2: Data Fetching & Sampling (Core Capability)

**Goal**: Enable users to fetch actual dataset contents with smart sampling.

**Tasks**:
1. Create `data-fetcher.ts`:
   - Download resource from URL
   - Detect format, parse CSV/JSON
   - Handle errors gracefully
2. Create `data-sampler.ts`:
   - Sample first N rows
   - Generate column statistics
   - Return formatted summary
3. Add `fetch_dataset_data` tool and enhance `get_dataset_details` with resource IDs
4. Test with various dataset formats from the portal

**Deliverables**:
- DataFetcher module with CSV/JSON support
- DataSampler module with statistics generation
- 1 new MCP tool (`fetch_dataset_data`)
- Enhanced `get_dataset_details` to include resource IDs
- Tests with real datasets

### Phase 3: Testing & Refinement

**Goal**: Ensure everything works end-to-end with real usage scenarios.

**Tasks**:
1. Test complete workflows end-to-end with Claude
2. Identify pain points, missing capabilities
3. Refine error messages and "next steps" suggestions
4. Document common patterns in docs/

**Deliverables**:
- Integration test suite
- Manual testing results
- Updated documentation
- Bug fixes from testing

### Future Phases

**Phase 4: Browser Automation & Excel Support** (✅ COMPLETED - October 2025)

**Phase 4.5: Browser Download Capability** (✅ COMPLETED - November 2025)

Addresses user need to save downloaded data locally:
- **Problem**: Users asked "Wo sind die Daten?" after fetching - data only existed in chat context
- **Solution**: New `download_dataset` tool that triggers browser download dialog
- **Implementation**:
  - MCP server returns file data with special marker: `[DOWNLOAD:filename:mimeType]\ndata`
  - Interface-prototype backend detects marker in tool results
  - Frontend triggers browser download using Blob API
  - Smart resource selection (prefers data formats over HTML/docs)
  - CSV and JSON output formats
  - Automatic filename generation from dataset title
- **Tool Disambiguation**: Updated descriptions to prevent confusion:
  - `fetch_dataset_data`: "VIEW dataset content in chat" (keywords: zeig mir, analysiere)
  - `download_dataset`: "DOWNLOAD as file" (keywords: herunterladen, auf meinem Computer)
- **Impact**: Enables complete workflow: discover → fetch → analyze → download
- **Status**: ✅ COMPLETE - Tested with real datasets, browser download dialog working

**Phase 4: Browser Automation & Excel Support** (✅ COMPLETED - October 2025)

This phase addresses two format-related limitations discovered during user testing:

**Part A: Browser Automation for SPA-Hosted Files** ✅
- Problem: 182 datasets (6.9% of portal) from statistik-berlin-brandenburg.de cannot be fetched
- Root cause: Single Page Application returns HTML, requires JavaScript to download files
- Solution: Puppeteer integration for JavaScript-rendered download URLs
- Implementation:
  - Added puppeteer as optional dependency
  - Created BrowserFetcher class with two-step approach:
    1. Navigate to SPA URL with headless browser
    2. Capture download URL from network traffic using `page.on('response')`
    3. Fetch captured URL directly with node-fetch
  - Automatic fallback to regular fetch for standard URLs
  - Browser automation enabled when Puppeteer is installed
- Trade-offs: ~300MB Chrome dependency, slower fetches, but unlocks 147 CSV files
- Impact: Unlocks 6.9% of portal datasets
- Testing: 100% success rate across 6 diverse datasets (447 to 388,724 rows)

**Part B: Excel Format Support (XLS/XLSX)** ✅
- Problem: 545 datasets (20.6% of portal) have Excel files; 30 datasets (1.14%) are Excel-ONLY
- Root cause: DataFetcher only supports CSV/JSON text formats
- Solution: xlsx library integration for Excel parsing
- Implementation:
  - Added xlsx as dependency (~2MB)
  - Parse Excel files to tabular JSON format (same as CSV)
  - Extract first sheet by default
  - Convert to standard row/column structure
- Trade-offs: Minimal - small dependency, quick implementation
- Impact: Unlocks 1.14% critical datasets, improves UX for 20.6% of portal

**Combined Impact**: +8% portal coverage (182 + 30 unique datasets)
**Status**: ✅ COMPLETE - All Phase 4 features implemented and tested

**Phase 5: Geodata Format Support** (✅ COMPLETED - November 2025)

This phase extends format support to handle geospatial data, significantly expanding portal coverage.

**Motivation**: 60.9% of portal datasets (1,620) use geodata formats that were unsupported. This represented the largest opportunity for expanding accessible data.

**Formats implemented**:

*Part A: File-Based Geodata* (78 datasets, 3.0%) ✅
- **GeoJSON** (39 datasets, 1.5%) - JSON-based vector data format
- **KML** (39 datasets, 1.5%) - XML-based format, converted to GeoJSON
- **Shapefiles** - SKIPPED (most datasets have GeoJSON/KML alternatives)

*Part B: WFS (Web Feature Service)* (596 datasets, 22.4%) ✅
- **OGC WFS 2.0.0 protocol** - Query and download vector features
- **Automatic GeoJSON output** - All WFS services return GeoJSON
- **Parameter preservation** - Handles service-specific params (e.g., nodeId)
- **Coordinate transformation** - Converts EPSG:25833 (UTM) to WGS84 (lat/lon)
- **WMS** (Web Map Service) - Deferred (returns images, not queryable data)

**Implementation details**:
- **WFSClient module**: GetCapabilities, GetFeature, pagination support
- **Smart parameter handling**: Preserves service-specific params, overrides WFS params
- **Geodata conversion**: Features → table rows with geometry columns
- **Coordinate transformation**: proj4 library for EPSG:25833 → WGS84
- **GeoJSON downloads**: Proper FeatureCollection structure with web-compatible coordinates

**Coverage impact**: +25.3% portal coverage
- File-based: 78 datasets (GeoJSON, KML)
- WFS services: 596 datasets (99%+ working with transformation)
- **Total coverage**: 41.9% → 64.2% (1,113 → 1,709 datasets)

**Phase 6: Data Filtering/Querying Tools**
- Accept filter parameters (e.g., "only rows where district='Mitte'")
- Server-side data reduction
- Column selection
- Row pagination within datasets

**Phase 7: Visualization Integration**
- Integration with Datawrapper API or similar
- Generate chart specifications (Vega-Lite)
- Return embed codes or image URLs
- Support common chart types (bar, line, scatter)

**Phase 8: Advanced Analysis Tools**
- Aggregation functions (group by, sum, average)
- Simple joins across datasets
- Correlation calculations server-side
- Statistical summaries

### Non-Goals for Initial Version

- No backward compatibility concerns (this is a prototype)
- No performance optimization/caching yet
- No authentication/rate limiting
- No Excel/proprietary format support initially
- No visualization generation
- No GeoJSON/spatial data support
- No server-side filtering/querying
- No multi-source data integration (Data Hub Berlin, etc.)

### Success Metrics

- Can answer "What datasets are available?" type questions
- Can fetch and sample real dataset contents
- Can support multi-step analytical workflows
- Tools chain together logically without dead ends
- Error messages are helpful and actionable
- Users can complete exploratory and analytical tasks

---

## Section 7: Design Decisions & Rationale

### Decision 1: Hybrid Processing (Server + LLM)

**Options Considered**:
- A) Client-side analysis (LLM does everything)
- B) Server-side analysis (MCP does everything)
- C) Hybrid approach

**Decision**: C - Hybrid approach

**Rationale**:
- Server handles data wrangling (Berlin-specific operations)
- LLM handles reasoning and orchestration
- Balances flexibility with reliability
- Can add server-side analysis tools incrementally as patterns emerge

**Trade-offs**:
- More complex than pure approaches
- Requires thoughtful boundary decisions
- BUT: Best fit for "discover as we go" philosophy

### Decision 2: Transparent Tool Chaining

**Options Considered**:
- A) Fully autonomous (single tool does everything)
- B) Exposed steps (each step is a separate tool)
- C) Hybrid with workflow tools

**Decision**: B - Exposed steps, with option to add workflow tools later

**Rationale**:
- Most transparent and debuggable
- LLM can adapt based on intermediate results
- Easier to understand what's happening
- Can abstract into higher-level tools if patterns emerge

**Trade-offs**:
- More back-and-forth between LLM and server
- BUT: Transparency and flexibility worth it for prototype

### Decision 3: Smart Sampling

**Options Considered**:
- A) Return raw data (entire dataset)
- B) Smart sampling (first N rows + stats)
- C) Streaming/pagination
- D) Query-based filtering

**Decision**: B - Smart sampling, with option for full data

**Rationale**:
- Prevents context window overflow
- Works universally without knowing schema
- Good for exploration (see structure immediately)
- Can request full data if needed

**Trade-offs**:
- Might miss important data in tail
- BUT: Can add query-based filtering later if needed

### Decision 4: Automatic Format Conversion

**Options Considered**:
- A) Automatic (always convert to standard format)
- D) Explicit (user specifies desired format)

**Decision**: A - Automatic conversion, with option to add explicit conversion later

**Rationale**:
- Less cognitive overhead for LLM
- User doesn't need to think about formats
- Simpler initial implementation

**Trade-offs**:
- Less control for advanced users
- BUT: Can add explicit conversion tool if users request it

### Decision 5: Single Data Source (Berlin Only)

**Options Considered**:
- A) Single monolithic server (all sources)
- B) Separate servers per source
- C) Abstracted data source layer

**Decision**: Focus on Berlin only, no multi-source support yet

**Rationale**:
- YAGNI - Data Hub Berlin is still just an idea
- Avoid premature abstraction
- Keep it simple for prototype

**Trade-offs**:
- Will require refactoring if we add sources later
- BUT: Much simpler to build and maintain now

### Decision 6: CSV/JSON Only (Initially)

**Options Considered**:
- A) CSV/JSON only
- B) Add basic GeoJSON support
- C) Full spatial support
- D) Format-agnostic (just return URLs)

**Decision**: A - CSV/JSON only, add GeoJSON later

**Rationale**:
- Covers most tabular use cases
- Simpler implementation
- Can add spatial support once we understand usage patterns

**Trade-offs**:
- Can't analyze spatial datasets initially
- BUT: Most common analyses are tabular

**Status**: ✅ IMPLEMENTED (CSV/JSON/Excel supported)

### Decision 7: Geodata Format Support Strategy

**Options Considered**:
- A) File-based only (GeoJSON, KML, Shapefiles)
- B) Web services only (WFS, WMS)
- C) Both file-based and web services
- D) Convert everything to one canonical format
- E) Preserve native formats

**Decision**: C - Both file-based and web services, with D - Convert to tabular format

**Rationale**:
- **File-based geodata** provides quick wins (94 datasets, 3.5%)
  - Straightforward download and parse
  - Reuse existing DataFetcher patterns
  - Libraries readily available (togeojson, shpjs, jszip)
- **WFS support** provides massive impact (596 datasets, 22.4%)
  - Standard OGC protocol, well-documented
  - Returns actual queryable vector data (vs WMS images)
  - Can request GeoJSON output format
- **Tabular conversion** makes geodata LLM-friendly
  - Each feature → table row
  - Properties → columns
  - Geometry → special columns (type, coordinates)
  - Enables same analysis patterns as CSV/JSON
  - No need for LLM to understand complex geometry structures

**Trade-offs**:
- Loses some spatial richness (can't easily perform geometric operations)
- BUT: Most use cases are about feature attributes, not geometric analysis
- WMS skipped (returns images, not queryable data)
- BUT: WMS has limited value for data analysis

**Implementation order**:
1. GeoJSON first (simplest - just JSON with schema)
2. KML second (XML, but library handles conversion)
3. WFS third (requires protocol understanding, pagination)

**Shapefiles skipped**: Most datasets with shapefiles also provide GeoJSON or KML alternatives, making shapefile support unnecessary complexity.

---

## Section 8: Technical Constraints & Assumptions

### Constraints

**Download Size Limit**: 50MB per resource (configurable)
- Rationale: Prevent memory issues and long download times
- Workaround: Can be increased if needed

**Request Timeout**: 30 seconds (configurable)
- Rationale: Prevent hanging on slow/unavailable resources
- Workaround: Can retry or use different resource

**Sample Size Limits**: Fixed 10 rows for previews
- Rationale: Minimal token usage for initial exploration
- Workaround: Use full_data flag for small datasets (≤500 rows only)

**No Rate Limiting**: Assume Berlin API has no rate limits
- Rationale: CKAN APIs typically don't rate limit
- Risk: Could be throttled if we make too many requests

**No Authentication**: Assume all data is publicly accessible
- Rationale: Open data portal shouldn't require auth
- Risk: Some resources might be behind auth

### Assumptions

**CKAN API Stability**: Assume Berlin's CKAN API is stable and follows standard conventions
- Validation: Test against live API during implementation

**Dataset Quality**: Assume most datasets are well-formed CSV/JSON
- Reality: Will encounter edge cases (encoding issues, malformed data)
- Mitigation: Robust error handling

**LLM Capabilities**: Assume Claude can perform basic statistical analysis on tabular data
- Validation: Test with sample analyses during Phase 3

**Network Availability**: Assume reliable network connection to Berlin portal
- Reality: Network errors will occur
- Mitigation: Good error messages with retry suggestions

**User Expectations**: Assume users want conversational, guided discovery rather than direct SQL-like queries
- Validation: Will refine based on actual usage

---

## Section 9: Open Questions & Future Considerations

### Open Questions

**Q0**: Should we expand keyword mappings in QueryProcessor for better search coverage?
- **Current answer**: Keep mappings focused (e.g., traffic: 6 core terms). Actual dataset analysis shows many related terms (öpnv, kfz, parken, baustellen, vbb, etc.) that could be added
- **Concern**: Expanding too much may reduce precision - "bus" and "parking" are both transportation but users might want different results
- **Reconsider when**: User feedback indicates missing relevant datasets, or we see common search patterns that fail
- **Data point**: Current "verkehr" search finds 701 datasets, suggesting broad coverage already works

**Q1**: Should we cache frequently accessed datasets?
- **Current answer**: No, fetch fresh each time
- **Reconsider when**: Performance becomes an issue or we see repeated queries for same data

**Q2**: How should we handle very large datasets (>50MB)?
- **Current answer**: Error message with suggestion to filter at source or download manually
- **Reconsider when**: Users frequently encounter this limitation

**Q3**: Should we support multiple resource formats from the same dataset in a single call?
- **Current answer**: No, fetch one resource at a time
- **Reconsider when**: Users want to compare different formats or combine multiple files

**Q4**: How should we handle datasets that require authentication?
- **Current answer**: Return error message, not supported
- **Reconsider when**: We encounter important datasets behind auth

**Q5**: Should we provide any privacy/anonymization features?
- **Current answer**: No, assume all data is already public
- **Reconsider when**: Users want to analyze sensitive data

**Q6**: ✅ RESOLVED - How to handle JavaScript-rendered download URLs (statistik-berlin-brandenburg.de)?
- **Context**: 182 datasets (6.9% of portal) use statistik-berlin-brandenburg.de URLs that return HTML instead of data files. These URLs require JavaScript execution to download.
- **Impact**: ~147 CSV files cannot be fetched programmatically, affecting 68.7% of Statistik datasets
- **Solution implemented**: Puppeteer-based browser automation with two-step URL capture approach
- **Implementation**: Phase 4 Part A - Completed October 2025
- **Results**: 100% success rate across 6 diverse test datasets (447 to 388,724 rows)
- **Trade-offs accepted**: ~300MB Chrome dependency and slower fetches for 6.9% more portal coverage

**Q7**: ✅ RESOLVED - Should we support Excel formats (XLS/XLSX)?
- **Context**: 545 datasets (20.6% of portal) have Excel files; 30 datasets (1.14%) are Excel-ONLY with no CSV/JSON alternative
- **Impact**: 30 datasets completely inaccessible without Excel support, 545 datasets with degraded UX
- **Solution implemented**: xlsx library integration for parsing Excel to tabular JSON
- **Implementation**: Phase 4 Part B - Completed October 2025
- **Results**: All Excel files now parse correctly to standard row/column format
- **Trade-offs**: Minimal - only 2MB dependency with significant UX improvement

### Future Considerations

**Visualization Integration**
- Wait to see what types of visualizations users actually want
- Consider Datawrapper, Observable, Plotly, or simple chart specs
- May want server-side rendering vs. client-side

**Spatial Data Support**
- Many Berlin datasets include geographic information
- Could add basic spatial queries (within bounds, distance)
- Consider PostGIS-like capabilities or simple coordinate extraction

**Advanced Analysis**
- As patterns emerge, add server-side analysis tools
- Examples: aggregation, joining, correlation, time-series analysis
- Balance between server and LLM computation

**Multi-Source Integration**
- If Data Hub Berlin or other sources become relevant
- Consider: separate servers vs. unified interface
- Abstraction layer might be needed then

**Performance Optimization**
- Caching strategy (what to cache, for how long)
- Incremental data loading for large datasets
- Connection pooling for API requests
- Background pre-fetching of popular datasets

**User Feedback Loop**
- Track which tools are used most
- Identify common workflow patterns
- Use to guide future development priorities

---

## Section 8: Deployment & Access

### Deployment Architecture

The Berlin Open Data MCP server is deployed as part of a unified backend service on Railway, providing both remote MCP access and a web-based chat interface.

**Infrastructure:**
- Platform: Railway (https://railway.app)
- Deployment URL: https://odis-production.up.railway.app
- Transport Protocol: Streamable HTTP (MCP protocol version 2025-03-26)
- Authentication: None (public access)

### Access Methods

#### 1. Remote MCP Access (Claude Desktop)

The server can be accessed directly from Claude Desktop using the `mcp-remote` proxy. This enables all Berlin Open Data tools in any Claude Desktop conversation.

**Configuration:**

Add to Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "berlin-data": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://odis-production.up.railway.app/mcp"
      ]
    }
  }
}
```

**Requirements:**
- Claude Pro, Team, or Enterprise plan (remote MCP not available on free tier)
- Internet connection
- `npx` available (comes with Node.js)

**Endpoint:** `https://odis-production.up.railway.app/mcp`

**Protocol:** Streamable HTTP transport over HTTPS
- Initialization: POST to `/mcp` with initialize request
- Session management: Via `mcp-session-id` header
- Request handling: All methods (GET/POST/DELETE) on single endpoint

#### 2. Web Chat Interface

For users without Claude Desktop or requiring no authentication, a web-based chat interface is available.

**URL:** https://odis-production.up.railway.app/

**Features:**
- Real-time tool execution display with collapsible badges
- WebSocket-based streaming responses
- Sandboxed JavaScript code execution for data analysis
- No authentication required
- Works in any modern web browser

**Architecture:**
- Frontend: Svelte + Vite (static build served by backend)
- Backend: Express + WebSocket server
- MCP Integration: Spawned stdio process for tool execution
- AI: Claude API for conversation orchestration

### Transport Protocol Details

**Why Streamable HTTP instead of SSE:**
- Streamable HTTP (2025-03-26) is the current MCP standard
- SSE transport (2024-11-05) is deprecated
- `mcp-remote` requires Streamable HTTP protocol
- Better session management and resumability support

**Implementation:**
- Single `/mcp` endpoint handles all operations
- Session initialization via POST with `initialize` request
- Subsequent requests include `mcp-session-id` header
- Session cleanup on transport close or explicit DELETE

### Local Development

For local testing and development:

```bash
# Start backend (includes MCP server)
cd interface-prototype
npm run dev:backend

# Test remote MCP endpoint locally
npx mcp-remote http://localhost:3000/mcp
```

---

## Appendix A: Key Terms & Definitions

**MCP (Model Context Protocol)**: Protocol for connecting LLMs to external tools and data sources

**CKAN**: Open-source data portal platform used by Berlin and many other governments

**Agentic Workflow**: Multi-step process where LLM autonomously chains tools together to accomplish a goal

**Smart Sampling**: Returning a representative subset of data with statistics rather than full dataset

**Tool Chaining**: LLM calling multiple tools in sequence, using output of one as input to next

**Berlin Open Data Portal**: https://daten.berlin.de/ - Official open data portal for Berlin

**Dataset**: Collection of related data, may contain multiple resources (files)

**Resource**: Individual file within a dataset (CSV, JSON, etc.)

**Package**: CKAN term for dataset

---

## Appendix B: References

**Berlin Open Data Portal**: https://daten.berlin.de/

**CKAN API Documentation**: https://docs.ckan.org/en/latest/api/

**Model Context Protocol**: https://modelcontextprotocol.io/

**Existing Documentation**:
- `docs/CLAUDE_DESKTOP_SETUP.md` - How to configure Claude Desktop
- `docs/USAGE.md` - Usage examples (to be updated)
- `README.md` - Project overview (to be updated)

---

## Document History

**Version 1.0** - [Date] - Initial design specification based on discovery conversation with Alsino

**Future versions**: Will be updated as implementation progresses and design evolves based on real usage
