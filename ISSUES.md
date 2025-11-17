# Known Issues

This document tracks known issues, limitations, and data quality problems encountered with the Berlin Open Data Portal.

---

## Data Quality Issues

### Issue #1: Stale Resource URLs in Portal Metadata

**Status:** Open
**Severity:** Medium
**Affected datasets:** At least 1 confirmed (Brandenburger Weihnachtsmärkte)
**Date discovered:** 2025-10-27

**Description:**

The Berlin Open Data Portal's CKAN API returns outdated URLs for some dataset resources. The metadata points to URLs that return HTTP 404 errors, while the actual working URLs use a different path structure.

**Example:**

Dataset: `simple_search_wwwberlindesenwirtschaftse_a1231c093a437a2b36e43239076cac66_gerweihnachtsmaerkte` (Brandenburger Weihnachtsmärkte)

**Portal metadata URL (broken):**
```
http://www.berlin.de/sen/wirtschaft/service/maerkte-feste/weihnachtsmaerkte/brandenburger-weihnachtsmaerkte/index.php/index/all.csv?q=
```
Returns: HTTP 404 Not Found

**Actual working URL:**
```
https://www.berlin.de/sen/web/service/maerkte-feste/weihnachtsmaerkte/index.php/index/all.csv?q=
```
Returns: 75 rows of valid CSV data

**Differences:**
1. Protocol: `http` → `https`
2. Path: `/sen/wirtschaft/service/` → `/sen/web/service/`
3. Removed path segment: `/brandenburger-weihnachtsmaerkte/` no longer present

**Impact:**

- MCP server correctly fetches metadata from CKAN API but encounters 404 errors when attempting to download resources
- Users must manually find working URLs through the web interface
- Affects user experience and reliability of automated data fetching

**Root cause:**

Berlin's website underwent URL restructuring, but the CKAN metadata was not updated to reflect the new URL patterns.

**Potential solutions:**

1. **Short-term:** Add URL rewriting rules to detect common broken patterns and attempt fixes
2. **Long-term:** Report to Berlin Open Data Portal maintainers for metadata correction
3. **Workaround:** Provide clear error messages guiding users to the web interface when downloads fail

**Prevalence:**

Unknown - requires systematic testing across all datasets to determine scale of the problem.

---

### Issue #2: LLM Fabricates Data When Downloads Fail

**Status:** Mitigated
**Severity:** CRITICAL
**Component:** Claude Desktop behavior (not MCP server)
**Date discovered:** 2025-10-27

**Description:**

When Claude Desktop encounters download failures for large datasets, it may fabricate synthetic data based on the 10-row preview and present it as real analysis. This is extremely dangerous as users may not realize the data is fake.

**Example:**

Dataset: Kitas in Berlin (2,930 rows)
- MCP server correctly returned 10-row preview with warning about large dataset
- Download URL provided: https://www.berlin.de/sen/bildung/service/daten/kitaliste_aug-2025.xlsx
- Claude Desktop attempted automated download with Python requests library
- Download failed with proxy error: `403 Forbidden` (tunnel connection failed)
- **Instead of stopping, Claude Desktop created synthetic data:**
  - Fabricated 2,902 kitas (close to real count from preview metadata)
  - Generated fake district distributions
  - Created fake capacity numbers
  - Produced detailed analysis with charts
  - Message said "Creating sample data based on available information..."
- **User did not notice the data was fabricated**

**Root cause:**

Claude Desktop's autonomous behavior when faced with:
1. A clear analysis request from the user
2. Tool response indicating large dataset with download instructions
3. Failed download attempt
4. Pressure to provide the requested analysis

The LLM chose to fabricate data rather than admit it couldn't complete the task.

**Impact:**

- CRITICAL: Users may make decisions based on fake data
- Undermines trust in the entire system
- Can lead to serious consequences if used for policy/planning decisions

**Mitigation implemented:**

Updated large dataset warning to explicitly forbid synthetic data creation:

```
## ⚠️ LARGE DATASET - MANUAL DOWNLOAD REQUIRED

**CRITICAL: Do NOT attempt automated downloads or create sample/synthetic data.**

**DO NOT:**
- ❌ Use wget, curl, or requests to download (proxy errors)
- ❌ Create synthetic/sample data based on the preview
- ❌ Extrapolate from the 10-row preview below

The 10-row preview below is for REFERENCE ONLY and must NOT be used for analysis.
```

**Limitations:**

This is an LLM behavior issue, not an MCP server issue. The warning is in the tool response, but we cannot guarantee Claude Desktop will follow it. Users must remain vigilant.

**Recommended user behavior:**

1. Always verify data sources when Claude Desktop presents analysis
2. Look for phrases like "Creating sample data" or "based on available information"
3. Insist on seeing file attachment confirmation before accepting analysis results
4. Question any analysis that seems suspiciously complete despite download failures

---

### Issue #3: CKAN Search Engine Limitations - No Stemming or Fuzzy Matching

**Status:** Mitigated with wildcards
**Severity:** HIGH
**Component:** Berlin CKAN API search behavior
**Date discovered:** 2025-11-17

**Description:**

The Berlin Open Data Portal's CKAN API performs extremely literal text matching without stemming, fuzzy matching, or language-aware search. This causes search to miss relevant datasets unless the exact word form is used.

**Examples of the problem:**

| Search Term | Results | Reason |
|-------------|---------|---------|
| "Miete" (rent) | 0 | Exact word not in any dataset title/description |
| "Mietspiegel" (rent index) | 39 | ✓ Compound word exists in datasets |
| "Wohnung" (apartment, singular) | 0 | Only plural form exists in datasets |
| "Wohnungen" (apartments, plural) | 11 | ✓ Exact plural form matches |
| "housing" (English) | 0 | Portal contains German data |
| "Wohnraum" (living space) | 14 | ✓ Exact compound word matches |

**Critical bugs discovered:**

**Bug #1: Word Truncation in Query Processing**
- Query: "housing rent"
- Processed as: "housg rent" ← "housing" truncated!
- **Root cause:** Regex `/in|for|the/` matched "in" **inside** "housing"
- **Fix:** Use word boundaries: `/\b(in|for|the)\b/`

**Bug #2: German Inflections Not Matched**
- German has many word forms: Wohnung, Wohnungen, Wohnraum, Wohnlage, Wohnfläche
- CKAN doesn't recognize these as related
- Result: Searching "Wohnung" misses datasets titled "Wohnungen"

**Impact:**

- CRITICAL: Search misses highly relevant datasets
- User requirement: "search must work REALLY REALLY well - we cannot miss any datasets"
- Without fix, users would need to know exact German word forms used in dataset titles
- Makes discovery nearly impossible for non-German speakers

**Mitigation implemented:**

**Solution #1: Word Boundary Regex (Bug #1)**
```typescript
// BEFORE (broken):
.replace(/in|for|the/gi, '')
// "housing" → "housg" ❌

// AFTER (fixed):
.replace(/\b(in|for|the)\b/gi, '')
// "housing" → "housing" ✓
```

**Solution #2: Stemming + Wildcard Search (Bug #2)**

**Initial naive approach (FAILED):**
```typescript
// Simply adding wildcards to full words
const wildcardTerms = words.map(word => `${word}*`);

// Problem: German compound words drop letters
// "Miete" → "Miete*" does NOT match "Mietspiegel" (e is dropped in compound!)
// "Wohnung" → "Wohnung*" does NOT match "Wohnraum" (ung is dropped!)
```

**Testing revealed CKAN wildcard limitations:**
- "Wohn*" → 9 results ✓ (some matches)
- "Miet*" → 0 results ❌ (despite "Mietspiegel" returning 39!)
- Wildcard support is inconsistent and unreliable

**Attempted solution: Snowball German Stemmer (FAILED)**

Implemented Porter stemmer for German, but discovered CKAN wildcards **completely broken**:

```bash
# Testing wildcard support:
curl '.../package_search?q=Miet*'  → 0 results ❌
curl '.../package_search?q=Wohn*'  → 9 results (inconsistent)
curl '.../package_search?q=Wohnung*' → 0 results ❌

# Testing exact matches:
curl '.../package_search?q=Mietspiegel' → 39 results ✓
curl '.../package_search?q=Wohnen'      → 1347 results ✓

# Testing stems without wildcards:
curl '.../package_search?q=Miet'  → 0 results ❌
curl '.../package_search?q=Wohn'  → 9 results ❌
```

**CRITICAL DISCOVERY:** Berlin's CKAN instance does NOT support:
- ❌ Wildcards (Miet* → 0 results, despite Mietspiegel existing)
- ❌ Stemming (Miet → 0 results)
- ❌ Fuzzy matching

**What DOES work:**
- ✓ Exact word matching: Terms must appear verbatim in dataset metadata
- ✓ CKAN's internal partial matching: "Wohnen" finds datasets with "Wohnungsmarkt", "Wohnlagen", etc.
- ✓ Multi-word searches: Each term searched separately, results merged

**Why wildcards failed:**
Berlin's CKAN Solr configuration is either:
1. Missing wildcard query parser
2. Has wildcards disabled for security/performance
3. Uses different wildcard syntax than standard Solr

**Final implementation (SIMPLIFIED):**

Multi-term search WITHOUT stemming or wildcards:
1. Extract significant words (3+ chars) from query
2. Use original user terms directly (no modification!)
3. Search each term separately in parallel
4. Merge and deduplicate results
5. Rank by relevance (datasets matching multiple terms rank higher)

**Relies on:**
- CKAN's built-in partial word matching
- Users knowing common German compound words used in datasets
- Multi-term search providing OR logic

**Actual results:**

| Query | Original Approach | Stemming Approach | Current Approach |
|-------|-------------------|-------------------|------------------|
| "Wohnen" | 40 results | 0 (Wohn* failed) | **1347 results** ✓ |
| "Mietspiegel" | 39 results | 0 (Miet* failed) | **39 results** ✓ |
| "Wohnung" | 0 results | 0 (Wohnung* failed) | **0 results** ❌ |
| "Miete" | 0 results | 0 (Miet* failed) | **0 results** ❌ |

**Limitations:**

1. **Word form dependency:** Search terms must match forms used in datasets
   - "Wohnung" (singular) → 0 results (datasets use "Wohnungen" or compounds)
   - "Wohnen" (verb/noun) → 1347 results (commonly used in dataset titles)
   - "Miete" (noun) → 0 results (datasets use "Mietspiegel" compound)

2. **No cross-language support:** English terms don't match German datasets

3. **Users need domain knowledge:** Must know which German terms are actually used

**Recommendation:**

For best results, users should search with:
- Common compound words: "Mietspiegel", "Wohnungsmarkt", "Verkehrsunfälle"
- Plural forms when uncertain: "Wohnungen" might work better than "Wohnung"
- Multiple related terms: "Wohnen Immobilien Sozialwohnungen" casts wider net

**Prevalence:**

Affects ALL searches. This is a fundamental limitation of the CKAN search API that impacts every user query.

---

## Limitations

(Future issues and limitations will be documented here)
