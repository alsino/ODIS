# Manual Testing Plan for Berlin Open Data MCP Server

**Version**: 3.0.0
**Date**: 2025-11-17
**Tester**: Alsino

## Pre-Testing Setup

- [x] Project built successfully (`npm run build`)
- [x] Claude Desktop configured at: `~/Library/Application Support/Claude/claude_desktop_config.json`
- [x] Claude Desktop restarted after latest build
- [x] Claude Desktop shows MCP server is connected (check status indicator)

---

## Test Suite 1: Portal Metadata & Navigation

### Test 1.1: Portal Statistics
**Tool**: `get_portal_stats`

**Test Query**:
```
What's in the Berlin Open Data Portal? Give me an overview.
```

**Expected Behavior**:
- Returns total datasets count (~2,600+)
- Shows number of organizations (~50+)
- Shows number of tags/categories
- Suggests next steps

**Success Criteria**:
- [x] Tool is called automatically
- [x] Numbers seem reasonable (2,660 datasets, 24 organizations, 4,525 tags)
- [x] Response is well-formatted
- [x] No errors

---

### Test 1.2: List All Datasets (Pagination)
**Tool**: `list_all_datasets`

**Test Query**:
```
Show me the first 10 datasets in the portal
```

**Expected Behavior**:
- Returns 10 dataset titles with IDs
- Shows pagination info (e.g., "Showing 1-10 of 2,600")
- Suggests how to get more results

**Follow-up Test**:
```
Show me the next 10 datasets (offset 10)
```

**Success Criteria**:
- [x] Pagination works correctly
- [x] Different datasets returned for offset (1-10 vs 11-20)
- [x] Formatting is clear
- [x] No duplicates between pages

---

## Test Suite 2: Dataset Discovery

### Test 2.1: Natural Language Search
**Tool**: `search_berlin_datasets`

**Test Query 1 (English)**:
```
Find datasets about bicycle infrastructure in Berlin
```

**Test Query 2 (German)**:
```
Suche Datensätze über Verkehr und öffentliche Verkehrsmittel
```

**Expected Behavior**:
- Returns relevant datasets
- Shows titles, descriptions, formats
- Handles both English and German queries
- Results are ranked by relevance

**Success Criteria**:
- [x] Finds relevant datasets (11 bicycle datasets, 132 traffic/transport datasets)
- [x] Both languages work
- [x] Results include metadata (descriptions, formats, tags)
- [x] No errors

**Additional Test - English/German Equivalence**:
- English "traffic and public transport" → 135 results
- German "Verkehr und öffentliche Verkehrsmittel" → 132 results
- [x] Nearly identical counts (2% difference)
- [x] Query expansion working for both languages

---

### Test 2.2: Get Dataset Details
**Tool**: `get_dataset_details`

**Test Query**:
```
Get details for the first bicycle dataset you found
```

**Expected Behavior**:
- Returns comprehensive metadata
- Shows all available resources (files)
- Includes descriptions, formats, URLs
- Shows update frequency, license, etc.

**Success Criteria**:
- [ ] Complete metadata shown
- [ ] Resources listed with formats
- [ ] URLs are present
- [ ] Well-structured response

---

## Test Suite 3: Data Fetching & Analysis

**Note**: Resource IDs are now included in `get_dataset_details` output (see Test 2.2).

### Test 3.1: Fetch Small Dataset (CSV)
**Tool**: `fetch_dataset_data`

**Test Query**:
```
Fetch the data from [a small CSV dataset, <500 rows]
```

**Expected Behavior**:
- Downloads and parses CSV
- Returns 10-row preview by default
- Shows column names and types
- Indicates dataset size (small/large)
- Suggests using `full_data: true` for small datasets

**Follow-up Test**:
```
Fetch the full data from that dataset
```

**Success Criteria**:
- [ ] CSV parsed correctly
- [ ] Preview shows actual data
- [ ] Column types inferred
- [ ] Full data available for small datasets
- [ ] No parsing errors

---

### Test 3.2: Fetch Large Dataset (CSV)
**Tool**: `fetch_dataset_data`

**Test Query**:
```
Fetch data from [a large CSV dataset, >500 rows]
```

**Expected Behavior**:
- Returns 10-row preview
- Shows warning about large dataset size
- Indicates full download not available
- Suggests manual download with URL
- Preview is for reference only

**Follow-up Test (should fail gracefully)**:
```
Fetch the full data from that large dataset
```

**Expected**: Error message explaining it's too large, suggesting manual download

**Success Criteria**:
- [ ] Preview works
- [ ] Large dataset warning shown
- [ ] Full data request refused politely
- [ ] Download URL provided
- [ ] Clear instructions given

---

### Test 3.3: Fetch Excel File
**Tool**: `fetch_dataset_data`

**Test Query**:
```
Find a dataset with XLSX format and fetch it
```

**Expected Behavior**:
- Automatically parses Excel file
- Returns first sheet
- Shows data in same format as CSV
- Column names detected from headers

**Success Criteria**:
- [ ] Excel file parsed
- [ ] Data returned in tabular format
- [ ] Headers correctly identified
- [ ] No format-related errors

---

### Test 3.4: Browser Automation (statistik-berlin-brandenburg.de)
**Tool**: `fetch_dataset_data` (with browser fallback)

**Test Query**:
```
Search for datasets from statistik-berlin-brandenburg.de and try to fetch one
```

**Expected Behavior**:
- Detects URL needs browser automation
- Falls back to Puppeteer if installed
- Successfully downloads CSV despite JavaScript requirement
- Parses data normally

**Success Criteria**:
- [ ] Browser automation triggers
- [ ] Download succeeds
- [ ] Data parsed correctly
- [ ] Performance acceptable (<60 seconds)

---

## Test Suite 4: Multi-Step Workflows

### Test 4.1: Exploratory Workflow
**Tools**: Multiple

**Test Scenario**:
```
I want to understand what environmental data is available.
Can you help me explore, find specific air quality datasets,
and show me a sample of the data?
```

**Expected Tool Chain**:
1. `discover_data_topics` or `search_berlin_datasets` (environment)
2. `search_berlin_datasets` (air quality)
3. `get_dataset_details` for promising dataset
4. `list_dataset_resources` to see files
5. `fetch_dataset_data` to get sample

**Success Criteria**:
- [ ] Claude chains tools autonomously
- [ ] Each step builds on previous
- [ ] Final result includes actual data sample
- [ ] No manual intervention needed

---

### Test 4.2: Analytical Workflow
**Tools**: Multiple

**Test Scenario**:
```
Which Berlin district has the most green space?
Find the data and give me the answer.
```

**Expected Tool Chain**:
1. `search_berlin_datasets` (green space by district)
2. `fetch_dataset_data` for green space data
3. Claude performs analysis on fetched data
4. Returns answer with methodology

**Success Criteria**:
- [ ] Finds correct dataset
- [ ] Fetches actual data
- [ ] Performs analysis
- [ ] Provides answer with source
- [ ] Shows work/methodology

---

### Test 4.3: Correlation Workflow
**Tools**: Multiple

**Test Scenario**:
```
Is there a correlation between air quality and traffic volume in Berlin?
Find relevant datasets and analyze.
```

**Expected Tool Chain**:
1. `search_berlin_datasets` (air quality)
2. `fetch_dataset_data` for air quality
3. `search_berlin_datasets` (traffic)
4. `fetch_dataset_data` for traffic data
5. Claude performs correlation analysis
6. Returns findings

**Success Criteria**:
- [ ] Finds both datasets
- [ ] Fetches both datasets
- [ ] Aligns data appropriately
- [ ] Performs statistical analysis
- [ ] Explains methodology and limitations

---

## Test Suite 5: Error Handling

### Test 5.1: Invalid Dataset ID

**Test Query**:
```
Get details for dataset "this-dataset-does-not-exist-12345"
```

**Expected Behavior**:
- Clear error message
- Suggests using search instead
- No crashes or stack traces

**Success Criteria**:
- [ ] Graceful error
- [ ] Helpful message
- [ ] Suggests next steps

---

### Test 5.2: Broken Resource URL

**Test Query**:
```
Try to fetch data from [dataset with known broken URL - see ISSUES.md]
```

**Expected Behavior**:
- Detects HTTP 404/403 error
- Provides clear error message
- Suggests manual download or alternative resources
- Doesn't crash

**Success Criteria**:
- [ ] Error caught gracefully
- [ ] User-friendly message
- [ ] Actionable alternatives suggested

---

### Test 5.3: Unsupported Format

**Test Query**:
```
Find a dataset with PDF or other non-tabular format and try to fetch it
```

**Expected Behavior**:
- Detects unsupported format
- Returns metadata with download URL
- Explains format not supported
- Doesn't attempt to parse

**Success Criteria**:
- [ ] Format detected correctly
- [ ] Polite error message
- [ ] Download URL provided
- [ ] No parsing attempts

---

## Test Suite 6: Edge Cases

### Test 6.1: Empty Search Results

**Test Query**:
```
Find datasets about "xyzabc123nonexistent"
```

**Expected Behavior**:
- Returns zero results gracefully
- Suggests broader search terms
- Recommends using discover_data_topics
- No errors

**Success Criteria**:
- [ ] Handles zero results
- [ ] Helpful suggestions
- [ ] No crashes

---

### Test 6.2: Very Large Dataset (>5000 rows)

**Test Query**:
```
[Find and try to fetch a very large dataset]
```

**Expected Behavior**:
- Returns 10-row preview
- Strong warning about size
- Refuses full_data request
- Provides download URL for manual access

**Success Criteria**:
- [ ] Preview works
- [ ] Size limits enforced
- [ ] Clear warnings given

---

## Post-Testing Review

### Overall System Health
- [ ] No crashes observed
- [ ] Response times acceptable (<10s for most queries)
- [ ] Error messages are user-friendly
- [ ] Tool chaining works autonomously
- [ ] Data quality seems accurate

### Documentation Accuracy
- [ ] README matches actual behavior
- [ ] Tool descriptions match functionality
- [ ] Examples in docs work as described
- [ ] ISSUES.md reflects current problems

### Critical Issues Found
```
[Record any critical issues here]
```

### Minor Issues Found
```
[Record any minor issues or improvements here]
```

### Recommendations
```
[Note any recommendations for next steps]
```

---

## Quick Test Commands (Copy-Paste Ready)

**Quick Portal Check**:
```
What's in the Berlin Open Data Portal?
```

**Quick Search Test**:
```
Find datasets about bicycles in Berlin
```

**Quick Fetch Test**:
```
Search for a small traffic dataset, show me the resources, and fetch the data
```

**Quick Workflow Test**:
```
I want to analyze green spaces by district. Find the data and show me a sample.
```

---

## Testing Notes

**Browser Automation Note**: If Puppeteer tests fail, verify it's installed:
```bash
cd /Users/alsino/Desktop/ODIS
npm list puppeteer
```

**Performance Expectations**:
- Simple searches: <2 seconds
- Dataset details: <3 seconds
- Data fetch (small): <5 seconds
- Data fetch (with browser): <60 seconds

**Known Issues** (from ISSUES.md):
- Some URLs may be stale (404 errors)
- Claude Desktop may attempt to fabricate data for large datasets despite warnings

---

## Testing Session 1 - 2025-11-17

### Bugs Found and Fixed

**Bug #1: discover_data_topics returning "undefined"**
- **Cause**: CKAN API returns string arrays, code expected objects
- **Fix**: Convert tag strings to objects, use `all_fields=true` for orgs
- **Status**: ✅ FIXED
- **Commit**: 8433bce

**Bug #2: search_berlin_datasets finding no results**
- **Cause**: Complex OR queries not handled well by CKAN Solr
- **Fix**: Simplified to use first significant word only
- **Status**: ✅ FIXED
- **Commit**: 8433bce, 2c0249b

### Test Results After Fixes

✅ **Portal Stats** - Working perfectly
✅ **Discover Topics** - Shows actual tag and org names
✅ **Search (single words)** - Working great:
  - "Fahrrad" → 17 results
  - "Umwelt" → 42 results
  - "Bevölkerung" → 4 results
  - "Wohnungen" → 11 results

⚠️ **Multi-word queries** - Improved in commit 2c0249b
  - Now uses first word only to avoid overly restrictive AND queries
  - "Verkehr Transport" should now find "Verkehr" datasets (hundreds)

### Next Testing Round

After restart, test:
1. "Verkehr" (should find hundreds of traffic datasets)
2. "Wohnen" (should find housing datasets)
3. Try fetching data from a small dataset
4. Try multi-step workflow

---

## Testing Session 2 - 2025-11-18

### Changes Made Before Testing

**Tool Removal #1** (Commit: f86d0d7):
- **Removed 2 tools**: `suggest_datasets` and `discover_data_topics`
  - Reason: Pure duplication (suggest_datasets) and low value (discover_data_topics returned 4,525 technical tags)
  - Result: 6 focused tools instead of 8

**Tool Removal #2** (In Progress):
- **Removed 1 tool**: `list_dataset_resources`
  - Reason: Redundant with `get_dataset_details` after adding resource IDs
  - **Enhanced**: `get_dataset_details` now includes resource IDs in output
  - Result: 5 focused tools instead of 6

### Tests Completed

✅ **Pre-Testing Setup** - All checks passed

✅ **Test 1.1: Portal Statistics**
- Tool called automatically
- Returned: 2,660 datasets, 24 organizations, 4,525 tags
- Claude showed excellent agentic behavior (auto-explored with multiple searches)

✅ **Test 1.2: Pagination**
- Both queries worked perfectly
- Offset parameter functioning correctly
- No duplicates between pages

✅ **Test 2.1: Natural Language Search**
- English: "bicycle infrastructure" → 11 highly relevant datasets
- German: "Verkehr und öffentliche Verkehrsmittel" → 132 relevant datasets
- Query expansion visible in results
- Metadata complete (descriptions, formats, tags)

✅ **Additional Test: English/German Equivalence**
- Tested same concept in both languages
- English "traffic and public transport" → 135 results
- German "Verkehr und öffentliche Verkehrsmittel" → 132 results
- **Conclusion**: Query expansion working excellently (only 2% difference)

✅ **Test 2.2: Get Dataset Details**
- Returned complete metadata (ID, org, last updated, description, tags)
- All 3 resources listed with formats (WFS, PDF)
- URLs present and well-structured
- License, author, maintainer information included

### Tool Streamlining During Testing
- Identified `list_dataset_resources` as redundant with `get_dataset_details`
- Added resource IDs to `get_dataset_details` output
- Removed `list_dataset_resources` tool
- Updated all documentation

### Next Steps
- Rebuild and test with 5 tools
- Continue with Test 3.1: Fetch Small Dataset
- Complete remaining test suites

---

**Testing Status**: In Progress - Session 2
**Last Updated**: 2025-11-18 (5 tools after streamlining, resource IDs added to get_dataset_details)
