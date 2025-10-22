# Changelog

All notable changes to the Berlin Open Data MCP Server.

## [2.0.0] - 2025-10-22

### Added - Phase 1: Portal Metadata & Navigation
- `get_portal_stats` tool for portal overview
- `list_all_datasets` tool with proper pagination
- Portal statistics API methods
- Enhanced pagination support

### Added - Phase 2: Data Fetching & Sampling
- `list_dataset_resources` tool to view available files
- `fetch_dataset_data` tool to download and parse data
- DataFetcher module for downloading CSV/JSON resources with papaparse
- DataSampler module for smart sampling and statistics
- Automatic format detection and conversion
- Column type inference and statistics
- Sample size limits to prevent context overflow
- Support for CSV and JSON formats with robust parsing

### Added - Phase 3: Documentation & Testing
- Integration test suite
- Comprehensive usage examples
- Updated README with new features
- CHANGELOG documentation

### Improved
- Error handling for network failures
- Error messages with actionable suggestions
- Type safety throughout codebase

### Fixed
- Corrected tool reference in `get_portal_stats` next steps

## [1.0.0] - 2025-10-22

### Initial Release
- Basic dataset search functionality
- Dataset details retrieval
- Category and organization listing
- Natural language query processing
- MCP protocol integration
