# WFS Investigation Results

## Summary

Berlin's Open Data Portal hosts 596 WFS (Web Feature Service) datasets representing 22.4% of all portal datasets. All WFS services follow the OGC WFS 2.0.0 standard and support GeoJSON output, making them compatible with our existing geodata parser.

## Key Findings

### 1. URL Structure

All Berlin WFS services follow a consistent pattern:

```
Base URL: https://gdi.berlin.de/services/wfs/{service_name}
```

Examples:
- `https://gdi.berlin.de/services/wfs/kita` (Kindergartens - 2,934 features)
- `https://gdi.berlin.de/services/wfs/lsa` (Traffic lights)
- `https://gdi.berlin.de/services/wfs/denkmale` (Monuments)

### 2. Portal Resource Patterns

Each WFS dataset in the portal typically has **two resources**:

1. **GetCapabilities URL** - Describes the service
   - Pattern: `{base_url}?REQUEST=GetCapabilities&SERVICE=wfs`
   - Returns: XML with service metadata, feature types, available operations

2. **API Endpoint URL** - Base service URL
   - Pattern: `{base_url}` (no query parameters)
   - Used for: All WFS operations (GetCapabilities, GetFeature, etc.)

### 3. WFS Protocol Operations

#### GetCapabilities

**Purpose**: Discover available feature types and service metadata

**Request:**
```
GET https://gdi.berlin.de/services/wfs/kita?SERVICE=WFS&REQUEST=GetCapabilities
```

**Response:** XML document (~95KB) containing:
- Service metadata (title, abstract, provider)
- Available feature types (e.g., `kita:kita`)
- Supported operations and output formats
- Spatial reference systems

**Key elements to parse:**
- `<FeatureType>` - Contains `<Name>`, `<Title>`, `<Abstract>`
- `<outputFormat>` - Available formats (GML, application/json, etc.)

#### GetFeature

**Purpose**: Retrieve actual feature data

**Request:**
```
GET https://gdi.berlin.de/services/wfs/kita?
    SERVICE=WFS&
    REQUEST=GetFeature&
    VERSION=2.0.0&
    TYPENAMES=kita:kita&
    OUTPUTFORMAT=application/json&
    COUNT=5&
    STARTINDEX=0
```

**Parameters:**
- `SERVICE=WFS` - Required, identifies WFS protocol
- `REQUEST=GetFeature` - Required, operation type
- `VERSION=2.0.0` - WFS version
- `TYPENAMES={namespace}:{type}` - Required, which feature type to fetch
- `OUTPUTFORMAT=application/json` - Returns GeoJSON (instead of GML XML)
- `COUNT={n}` - Limit number of features returned (pagination)
- `STARTINDEX={n}` - Starting index for pagination (zero-based)

**Response:** GeoJSON FeatureCollection

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "kita.01010010",
      "geometry": {
        "type": "Point",
        "coordinates": [390387.4, 5820383.1]
      },
      "properties": {
        "e_nr": "01010010",
        "e_name": "Kita F.A.I.R.play",
        "e_bez": "Mitte",
        "e_plz": "10117",
        "e_strasse": "Albrechtstr.",
        ...
      }
    }
  ]
}
```

### 4. Pagination Support

WFS services support pagination for large datasets:

**Get total count:**
```
GET {base_url}?SERVICE=WFS&REQUEST=GetFeature&TYPENAMES={type}&RESULTTYPE=hits
```

Returns XML with `numberMatched` attribute (e.g., `numberMatched="2934"`)

**Fetch page:**
```
COUNT=100&STARTINDEX=0    # First 100 features
COUNT=100&STARTINDEX=100  # Next 100 features
```

**Example dataset size:** Kitas has 2,934 features

### 5. Compatibility with Existing Code

**Great news:** WFS responses are already compatible with our existing implementation!

- WFS GetFeature returns standard GeoJSON when `OUTPUTFORMAT=application/json`
- Our existing `parseGeoJSON()` in `data-fetcher.ts` can handle these responses
- Feature properties, geometry types, and coordinates follow same structure

**No new parsing needed** - just need WFS protocol client to fetch the data.

## Implementation Requirements

### New Module: `wfs-client.ts`

Create a WFS client to handle OGC protocol operations:

```typescript
class WFSClient {
  // Parse WFS URL to extract base service URL
  parseWFSUrl(url: string): { baseUrl: string; hasParams: boolean }

  // Execute GetCapabilities request
  async getCapabilities(baseUrl: string): Promise<WFSCapabilities>

  // Execute GetFeature request with pagination
  async getFeatures(baseUrl: string, typeName: string, options?: {
    count?: number,
    startIndex?: number
  }): Promise<GeoJSON.FeatureCollection>

  // Get total feature count
  async getFeatureCount(baseUrl: string, typeName: string): Promise<number>
}

interface WFSCapabilities {
  featureTypes: Array<{
    name: string;        // e.g., "kita:kita"
    title: string;       // e.g., "Kindertagesstätten"
    abstract?: string;
  }>;
  supportedFormats: string[];
}
```

### Integration into DataFetcher

Add WFS detection and routing in `data-fetcher.ts`:

```typescript
async fetchResource(url: string, format: string): Promise<FetchedData> {
  // Detect WFS URL
  if (format.toUpperCase() === 'WFS' || this.isWFSUrl(url)) {
    return this.fetchWFS(url);
  }

  // ... existing code for CSV/JSON/Excel/etc.
}

private isWFSUrl(url: string): boolean {
  return url.includes('gdi.berlin.de/services/wfs') ||
         url.includes('REQUEST=GetCapabilities') ||
         url.includes('SERVICE=wfs');
}

private async fetchWFS(url: string): Promise<FetchedData> {
  const wfsClient = new WFSClient();

  // Parse URL to get base service URL
  const { baseUrl } = wfsClient.parseWFSUrl(url);

  // Get capabilities to discover feature types
  const capabilities = await wfsClient.getCapabilities(baseUrl);

  if (capabilities.featureTypes.length === 0) {
    throw new Error('No feature types available in WFS service');
  }

  // Use first feature type (most services have only one)
  const typeName = capabilities.featureTypes[0].name;

  // Fetch features as GeoJSON (with pagination)
  const geojson = await wfsClient.getFeatures(baseUrl, typeName, {
    count: 1000  // Reasonable default
  });

  // Use existing GeoJSON parser
  return this.parseGeoJSON(geojson);
}
```

### Pagination Strategy

**Challenge:** Large WFS datasets (e.g., 2,934 kitas) exceed context limits

**Solution:** Same approach as existing data sampling

1. Fetch first N features (e.g., 1000)
2. Include total count in metadata
3. For large datasets (>500 features), return preview + stats
4. User can request full data via download tool

**Implementation in data-sampler.ts:**
- No changes needed
- WFS returns GeoJSON → parsed to rows → sampled same as CSV/JSON
- Existing `generateSample()` handles pagination display

## Testing Plan

### Unit Tests

Test WFS protocol operations:

1. Parse various WFS URL formats
2. GetCapabilities XML parsing
3. GetFeature with pagination
4. Error handling (invalid service, network errors)

### Integration Tests

Test with real Berlin WFS services:

1. **Kita** (2,934 features) - Large dataset, good for pagination testing
2. **LSA** (traffic lights) - Different properties
3. **Denkmale** (monuments) - Cultural data

### Test Script

Created: `scripts/test-wfs-protocol.ts`
- ✅ Tests GetCapabilities parsing
- ✅ Tests GetFeature with GeoJSON output
- ✅ Tests pagination (COUNT, STARTINDEX)
- ✅ Tests multiple services

## Estimated Implementation Time

- **WFSClient module:** 2-3 hours
  - URL parsing: 30 min
  - GetCapabilities: 1 hour (XML parsing)
  - GetFeature: 1 hour (request building, error handling)
  - Tests: 30 min

- **DataFetcher integration:** 1 hour
  - WFS detection: 15 min
  - Routing logic: 30 min
  - Error handling: 15 min

- **Testing & debugging:** 1-2 hours
  - Unit tests: 30 min
  - Integration tests with real services: 1 hour
  - Edge cases: 30 min

**Total: 4-6 hours**

## Dependencies

**New:**
- None! Already have `@xmldom/xmldom` for KML parsing
- Can reuse for GetCapabilities XML parsing

**Existing (already installed):**
- `@xmldom/xmldom` - XML parsing for GetCapabilities
- `node-fetch` - HTTP requests
- `@tmcw/togeojson` - Not needed (WFS returns GeoJSON directly)

## Open Questions

### Q1: Should we cache GetCapabilities responses?

**Current answer:** No, fetch fresh each time (consistent with current approach)

**Reconsider if:** Performance becomes an issue, but GetCapabilities is fast (<200ms)

### Q2: How to handle WFS services with multiple feature types?

**Current answer:** Use first feature type (most Berlin services have only one)

**Future enhancement:** Let user specify which feature type via tool parameter

### Q3: What COUNT limit to use for initial fetch?

**Options:**
- 100 features (conservative, fast)
- 500 features (matches our small dataset threshold)
- 1000 features (reasonable for most analyses)

**Recommendation:** 1000 features initially, same sampling logic as existing code

### Q4: Should we support spatial filtering (BBOX)?

**Current answer:** No, not in initial implementation (YAGNI)

**Reconsider when:** Users request filtering by location/bounds

## Coverage Impact

**Current coverage:** 1,113 datasets (41.9%)
- CSV/JSON/Excel: 1,035 (38.9%)
- GeoJSON/KML: 78 (3.0%)

**After WFS implementation:** 1,709 datasets (64.2%)
- +596 WFS datasets (22.4%)

**Impact:** Single largest coverage increase, unlocking geospatial analysis capabilities

## Next Steps

1. ✅ Investigate WFS URLs and protocol
2. ✅ Test actual WFS requests
3. ✅ Document findings
4. Create `wfs-client.ts` module
5. Integrate into `data-fetcher.ts`
6. Add tests
7. Update documentation (README, tool descriptions)
8. Commit and test with Claude Desktop

## References

- [OGC WFS 2.0.0 Specification](https://www.ogc.org/standards/wfs)
- [Berlin GDI WFS Services](https://gdi.berlin.de/services/wfs/)
- Berlin portal WFS analysis: `scripts/analyze-wfs.ts`
- Protocol testing: `scripts/test-wfs-protocol.ts`
