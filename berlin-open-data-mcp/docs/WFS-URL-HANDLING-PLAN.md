# WFS URL Handling - Improvement Plan

## Problem Statement

Current WFS implementation assumes all services follow the `gdi.berlin.de/services/wfs/{name}` pattern and strips ALL query parameters. This breaks services that require specific parameters like `nodeId`.

## Actual WFS URL Landscape

Analysis of 582 WFS datasets reveals **1,156 total WFS resources** across multiple patterns:

### URL Patterns by Host

**1. gdi.berlin.de** - 1,024 resources (89%)
```
Pattern: https://gdi.berlin.de/services/wfs/{service_name}
Examples:
  - https://gdi.berlin.de/services/wfs/kita
  - https://gdi.berlin.de/services/wfs/lsa?REQUEST=GetCapabilities&SERVICE=wfs
```

**2. fbinter.stadt-berlin.de** - 127 resources (11%)
```
Pattern: https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/{service_name}
Examples:
  - https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_es_daten_2022
  - https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_es_daten_2022?REQUEST=GetCapabilities&SERVICE=wfs
```

**3. energieatlas.berlin.de** - ~2 resources (<1%)
```
Pattern: https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId={id}&Service=WFS&request=GetCapabilities
Examples:
  - https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities (KWK)
  - https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=297&Service=WFS&request=GetCapabilities (E-Ladesäulen)
```
**Critical requirement:** `nodeId` parameter MUST be preserved!

**4. Others** - 3 resources (<1%)
- api.viz.berlin.de (1)
- dservices-eu1.arcgis.com (1)
- fbinter.stadt-berlin.deua_klimabewertung_2022 (1 - looks like data quality issue)

### Query Parameter Patterns

From 1,156 resources:
- **561 (48%)** have `REQUEST=GetCapabilities&SERVICE=wfs` (uppercase)
- **13** have lowercase params: `request=getcapabilities&service=wfs&version=2.0.0`
- **6** have just `request&service`
- **575 (50%)** have NO parameters (bare base URL)
- **1** has specific GetFeature params with typename

## Current Implementation Issues

### Issue #1: Strips ALL Query Parameters

```typescript
// Current code in wfs-client.ts
parseWFSUrl(url: string): { baseUrl: string; hasParams: boolean } {
  const urlObj = new URL(url);
  const hasParams = urlObj.search.length > 0;

  // ❌ PROBLEM: Strips ALL params including nodeId
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  return { baseUrl, hasParams };
}
```

**Result:** `energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298` → `energieatlas.berlin.de/public/ogcsl.ashx`

Then GetCapabilities request becomes:
```
https://energieatlas.berlin.de/public/ogcsl.ashx?SERVICE=WFS&REQUEST=GetCapabilities
```
**Missing `nodeId=298`** → Request fails!

### Issue #2: Assumes Simple URL Structure

GetFeature builds URL like:
```typescript
const url = new URL(baseUrl);
url.searchParams.set('SERVICE', 'WFS');
url.searchParams.set('REQUEST', 'GetFeature');
// ...
```

This works for clean base URLs but loses any existing params.

## Solution Design

### Strategy: Smart Parameter Preservation

**Preserve non-WFS parameters**, only override WFS-specific ones.

**WFS-specific parameters** (to override):
- `SERVICE` / `service`
- `REQUEST` / `request`
- `VERSION` / `version`
- `TYPENAMES` / `typenames` / `typename`
- `OUTPUTFORMAT` / `outputformat`
- `COUNT` / `count`
- `STARTINDEX` / `startindex`
- `RESULTTYPE` / `resulttype`

**Preserve all other parameters** (like `nodeId`, `SRSNAME`, custom params)

### Implementation Plan

#### Step 1: Fix `parseWFSUrl()`

```typescript
parseWFSUrl(url: string): { baseUrl: string; preservedParams: URLSearchParams } {
  const urlObj = new URL(url);

  // Separate WFS params from other params
  const wfsParamNames = new Set([
    'service', 'SERVICE',
    'request', 'REQUEST',
    'version', 'VERSION',
    'typenames', 'TYPENAMES', 'typename', 'TYPENAME',
    'outputformat', 'OUTPUTFORMAT',
    'count', 'COUNT',
    'startindex', 'STARTINDEX',
    'resulttype', 'RESULTTYPE',
    'srsname', 'SRSNAME' // Optional: might want to preserve this
  ]);

  const preservedParams = new URLSearchParams();

  // Keep only non-WFS params
  for (const [key, value] of urlObj.searchParams) {
    if (!wfsParamNames.has(key)) {
      preservedParams.set(key, value);
    }
  }

  // Base URL without any query params
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  return { baseUrl, preservedParams };
}
```

#### Step 2: Update `getCapabilities()`

```typescript
async getCapabilities(baseUrl: string, preservedParams?: URLSearchParams): Promise<WFSCapabilities> {
  const url = new URL(baseUrl);

  // Add preserved params first
  if (preservedParams) {
    for (const [key, value] of preservedParams) {
      url.searchParams.set(key, value);
    }
  }

  // Add/override WFS params
  url.searchParams.set('SERVICE', 'WFS');
  url.searchParams.set('REQUEST', 'GetCapabilities');

  const response = await fetch(url.toString(), { ... });
  // ... rest of implementation
}
```

#### Step 3: Update `getFeatures()`

```typescript
async getFeatures(
  baseUrl: string,
  typeName: string,
  options: WFSFeatureOptions = {},
  preservedParams?: URLSearchParams
): Promise<FeatureCollection> {
  const { count = 1000, startIndex = 0 } = options;
  const url = new URL(baseUrl);

  // Add preserved params first
  if (preservedParams) {
    for (const [key, value] of preservedParams) {
      url.searchParams.set(key, value);
    }
  }

  // Add/override WFS params
  url.searchParams.set('SERVICE', 'WFS');
  url.searchParams.set('REQUEST', 'GetFeature');
  url.searchParams.set('VERSION', '2.0.0');
  url.searchParams.set('TYPENAMES', typeName);
  url.searchParams.set('OUTPUTFORMAT', 'application/json');
  url.searchParams.set('COUNT', count.toString());
  url.searchParams.set('STARTINDEX', startIndex.toString());

  const response = await fetch(url.toString(), { ... });
  // ... rest of implementation
}
```

#### Step 4: Update `fetchWFS()` in data-fetcher.ts

```typescript
private async fetchWFS(url: string): Promise<FetchedData> {
  try {
    const wfsClient = new WFSClient();

    // Parse URL and preserve non-WFS params
    const { baseUrl, preservedParams } = wfsClient.parseWFSUrl(url);

    // Get capabilities (with preserved params)
    const capabilities = await wfsClient.getCapabilities(baseUrl, preservedParams);

    // ... check for feature types ...

    const featureType = capabilities.featureTypes[0];
    const totalCount = await wfsClient.getFeatureCount(baseUrl, featureType.name, preservedParams);

    // Fetch features (with preserved params)
    const geojson = await wfsClient.getFeatures(
      baseUrl,
      featureType.name,
      { count: 1000, startIndex: 0 },
      preservedParams
    );

    // ... rest of implementation
  }
}
```

## Testing Plan

### Test Cases

#### Test 1: Clean URL (gdi.berlin.de)
```
Input: https://gdi.berlin.de/services/wfs/kita
Expected:
  - GetCapabilities: https://gdi.berlin.de/services/wfs/kita?SERVICE=WFS&REQUEST=GetCapabilities
  - GetFeature: https://gdi.berlin.de/services/wfs/kita?SERVICE=WFS&REQUEST=GetFeature&...
Result: Should work ✓
```

#### Test 2: URL with existing GetCapabilities (gdi.berlin.de)
```
Input: https://gdi.berlin.de/services/wfs/lsa?REQUEST=GetCapabilities&SERVICE=wfs
Expected:
  - Strips REQUEST/SERVICE params
  - GetCapabilities: https://gdi.berlin.de/services/wfs/lsa?SERVICE=WFS&REQUEST=GetCapabilities
  - GetFeature: https://gdi.berlin.de/services/wfs/lsa?SERVICE=WFS&REQUEST=GetFeature&...
Result: Should work ✓
```

#### Test 3: energieatlas with nodeId (CRITICAL)
```
Input: https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities
Expected:
  - Preserves nodeId=298
  - Strips Service/request params
  - GetCapabilities: https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&SERVICE=WFS&REQUEST=GetCapabilities
  - GetFeature: https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&SERVICE=WFS&REQUEST=GetFeature&...
Result: Must work! ✓
```

#### Test 4: fbinter.stadt-berlin.de
```
Input: https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_es_daten_2022
Expected:
  - GetCapabilities: https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_es_daten_2022?SERVICE=WFS&REQUEST=GetCapabilities
Result: Should work ✓
```

### Test Script

Create comprehensive test script:
```bash
npx tsx scripts/test-wfs-url-handling.ts
```

Tests:
1. URL parsing with parameter preservation
2. GetCapabilities with each URL pattern
3. GetFeature with each URL pattern
4. End-to-end fetch for all patterns

## Implementation Steps

1. ✅ Analyze all WFS URLs in portal (DONE)
2. ✅ Document findings and create plan (DONE)
3. Update `wfs-client.ts`:
   - Fix `parseWFSUrl()` to return preserved params
   - Update `getCapabilities()` signature
   - Update `getFeatures()` signature
   - Update `getFeatureCount()` signature
4. Update `data-fetcher.ts`:
   - Pass preserved params through all WFS calls
5. Create test script `test-wfs-url-handling.ts`
6. Run tests against all patterns
7. Test manually with KWK dataset in Claude Desktop
8. Update docs if needed
9. Commit with clear description of fix

## Expected Impact

- **Current**: ~1,024 working WFS resources (gdi.berlin.de + fbinter)
- **After fix**: +2 energieatlas resources + any others with special params
- **Coverage**: 1,026 → 1,156 WFS resources (all of them!)

## Estimated Time

- Implementation: 1 hour
- Testing: 30 min
- Debugging edge cases: 30 min
- Total: **2 hours**

## Open Questions

### Q1: Should we preserve SRSNAME parameter?

**Context:** SRSNAME specifies coordinate reference system. Some URLs have it.

**Options:**
- A) Preserve it (don't override)
- B) Strip it and let service use default

**Recommendation:** Preserve it - service-specific param that we shouldn't override.

### Q2: Case sensitivity for parameter names?

**Context:** Portal has both `SERVICE` and `service`, `REQUEST` and `request`

**Solution:** Check both cases when filtering (already in plan above).

### Q3: What about malformed URLs?

**Context:** Found 1 URL: `fbinter.stadt-berlin.deua_klimabewertung_2022` (missing `//`)

**Solution:** Let URL parsing fail with error message. Data quality issue, not our problem.

## Success Criteria

1. ✓ KWK dataset (energieatlas nodeId=298) works
2. ✓ E-Ladesäulen dataset (energieatlas nodeId=297) works
3. ✓ gdi.berlin.de services still work
4. ✓ fbinter.stadt-berlin.de services still work
5. ✓ No regression in existing functionality
6. ✓ Test script passes all cases

## Related Files

- `src/wfs-client.ts` - Core WFS protocol implementation
- `src/data-fetcher.ts` - Integration layer
- `scripts/analyze-all-wfs-urls.ts` - Portal analysis (DONE)
- `scripts/test-wfs-url-handling.ts` - New comprehensive tests (TODO)
- `docs/WFS-INVESTIGATION.md` - Original investigation
