# Usage Examples

This document shows real-world usage examples of the Berlin Open Data MCP Server.

## Getting Started

### Basic Portal Exploration

**Question**: "What data is available in Berlin?"

**Tools used**: `get_portal_stats`

**Result**: Overview showing:
- Total datasets: ~1500
- Organizations: ~50
- Categories: ~200

---

### Finding Specific Data

**Question**: "Find datasets about bicycle infrastructure"

**Tools used**: `search_berlin_datasets`

**Result**: List of relevant datasets including:
- Bicycle parking locations
- Bike lane network data
- Bike-sharing station information

---

### Fetching Actual Data

**Question**: "Get the bicycle parking data"

**Tools used**:
1. `search_berlin_datasets` to find the dataset
2. `get_dataset_details` to see available resources
3. `fetch_dataset_data` to download and parse the data

**Result**: Smart sample of the data (first 100 rows) with:
- Column names and types
- Statistics (min/max for numbers, unique counts)
- Sample values
- Total row count

---

## Excel File Support

**Question**: "Get data from an Excel file"

The server automatically handles Excel files (XLS and XLSX formats):

**Workflow**:
```
User: "Fetch data from dataset XYZ"
→ Server detects XLSX format
→ Parses first sheet automatically
→ Returns same tabular structure as CSV
```

**Notes**:
- First sheet is used by default
- Headers are detected automatically
- Returns data in same format as CSV (rows + columns)
- Supports both legacy XLS and modern XLSX

**Coverage**: 545 datasets (20.6% of portal) include Excel files. The server handles them transparently.

---

## Advanced Workflows

### Multi-Dataset Analysis

**Question**: "Which district has the most parks?"

**Workflow**:
1. Search for park/green space datasets
2. Fetch the green space data
3. Search for district boundary data
4. Fetch district data
5. Perform aggregation by district
6. Return answer

**Tools chain**:
```
search_berlin_datasets("parks green space")
→ get_dataset_details(dataset_id)
→ fetch_dataset_data(dataset_id)
→ [Analysis performed by LLM using fetched data]
→ Answer
```

---

### Correlation Analysis

**Question**: "Is there a relationship between air quality and green spaces?"

**Workflow**:
1. Find air quality measurement data
2. Find green space area data
3. Fetch both datasets
4. Align by district/location
5. Calculate correlation
6. Interpret results

**Tools chain**:
```
search_berlin_datasets("air quality luftqualität")
→ fetch_dataset_data(air_quality_dataset_id)
→ search_berlin_datasets("green space grünflächen")
→ fetch_dataset_data(green_space_dataset_id)
→ [LLM performs correlation analysis]
→ Answer with statistical findings
```

---

## Tips for Effective Usage

### 1. Start Broad, Then Narrow

```
❌ Bad: Immediately fetching data without knowing what's available
✅ Good: get_portal_stats → discover_data_topics → search → fetch
```

### 2. Check Resources Before Fetching

```
❌ Bad: fetch_dataset_data without knowing the format
✅ Good: list_dataset_resources → choose appropriate resource → fetch
```

### 3. Use Smart Sampling for Large Datasets

```
❌ Bad: fetch_dataset_data with full_data=true on 100k row dataset
✅ Good: fetch_dataset_data with default sampling (100 rows)
```

---

## Common Patterns

### Pattern 1: Data Discovery
```
get_portal_stats
→ discover_data_topics (optional, for browsing)
→ search_berlin_datasets
→ get_dataset_details
```

### Pattern 2: Quick Analysis
```
search_berlin_datasets
→ fetch_dataset_data
→ [Analysis]
```

### Pattern 3: Comprehensive Study
```
get_portal_stats
→ search_berlin_datasets (with category keywords)
→ [Select multiple datasets]
→ fetch_dataset_data (multiple times)
→ [Cross-dataset analysis]
```

---

## Troubleshooting

### "No resources available"
- Some datasets are metadata-only
- Use `get_dataset_details` to check if resources exist
- Try related datasets instead

### "Error fetching data"
- Resource URL may be invalid or server down
- Try different resource from same dataset
- Check format - CSV, JSON, and Excel (XLS/XLSX) are fully supported

### "Server returned HTML instead of CSV"

Some datasets (especially from statistik-berlin-brandenburg.de) require JavaScript to download.

**Solution**:
1. Install Puppeteer: `npm install puppeteer`
2. Restart the MCP server
3. The server will automatically use browser automation for these URLs

**Alternative**: Download manually from the dataset page

### "Dataset too large"
- Use smart sampling (default behavior)
- Consider filtering data at source if API supports it
- Analyze sample and extrapolate if appropriate

### "No results found"
- Try German keywords (e.g., "Verkehr" vs "traffic")
- Use broader search terms
- Browse categories with `discover_data_topics`

---

## Performance Tips

1. **Pagination**: Always specify reasonable `limit` values (10-100)
2. **Sample first**: Don't use `full_data=true` unless necessary
3. **Reuse dataset IDs**: If analyzing multiple resources from same dataset, store the ID

---

## API Limits

- Maximum download size: 50MB per resource
- Default sample size: 100 rows
- Maximum sample size: 1000 rows
- Request timeout: 30 seconds
- No rate limiting (but be respectful)
