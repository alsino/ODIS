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

## Limitations

(Future issues and limitations will be documented here)
