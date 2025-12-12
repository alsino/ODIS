# Design Spec: Choropleth Maps with Berlin Basemaps

## Overview

Enable choropleth map creation using Datawrapper's predefined Berlin basemaps, auto-detecting the appropriate basemap from input data with user confirmation.

### Problem

The current implementation attempts to upload GeoJSON to the data endpoint, which doesn't work for choropleth maps. Datawrapper choropleth maps require:
1. A predefined basemap (or custom TopoJSON upload)
2. CSV data with region identifiers matching the basemap keys
3. Proper metadata configuration (`visualize.basemap`, `axes.keys`, `axes.values`)

### Solution

Accept tabular data (like bar charts), auto-detect Berlin LOR regions, and create maps using Datawrapper's predefined Berlin basemaps.

## Data Flow

```
Input Data (array of objects)
    ↓
Detect ALL available region columns (BEZ_ID, PGR_ID, BZR_ID, PLR_ID, or names)
    ↓
Return detection result to Claude
    ↓
Claude presents options to user for confirmation/aggregation choice
    ↓
User confirms level
    ↓
Create chart with chosen basemap (Claude aggregates data if needed)
    ↓
Publish chart
```

## Supported Basemaps

| LOR Level | Basemap ID | ID Column | ID Key | Name Key | Count |
|-----------|------------|-----------|--------|----------|-------|
| Bezirke | `berlin-boroughs` | `BEZ_ID` | `Gemeinde_s` (3-digit) | `Gemeinde_n` | 12 |
| Prognoseräume | `berlin-prognoseraume-2021` | `PGR_ID` | `PGR_ID` | `PGR_NAME` | 58 |
| Bezirksregionen | `berlin-bezreg-2021` | `BZR_ID` | `BZR_ID` | `BZR_NAME` | 143 |
| Planungsräume | `berlin-planungsraeume-2021` | `PLR_ID` | `PLR_ID` | `PLR_NAME` | 542 |

**Note:** `berlin-boroughs` uses 3-digit codes ("001", "002", etc.) while standard LOR uses 2-digit codes ("01", "02", etc.). The implementation must pad 2-digit BEZ_IDs to 3 digits.

## Basemap Detection Logic

### Detection Order (most specific first)

| Priority | Column Pattern | Basemap | Key Attribute |
|----------|---------------|---------|---------------|
| 1 | `PLR_ID` or 8-digit codes | `berlin-planungsraeume-2021` | `PLR_ID` |
| 2 | `BZR_ID` or 6-digit codes | `berlin-bezreg-2021` | `BZR_ID` |
| 3 | `PGR_ID` or 4-digit codes | `berlin-prognoseraume-2021` | `PGR_ID` |
| 4 | `BEZ_ID` or 2-digit codes | `berlin-boroughs` | `Gemeinde_s` (pad to 3 digits) |
| 5 | Names matching Bezirke | `berlin-boroughs` | `Gemeinde_n` |
| 6 | Names matching Prognoseräume | `berlin-prognoseraume-2021` | `PGR_NAME` |
| 7 | Names matching Bezirksregionen | `berlin-bezreg-2021` | `BZR_NAME` |
| 8 | Names matching Planungsräume | `berlin-planungsraeume-2021` | `PLR_NAME` |

### Detection Process

1. Look for columns with standard LOR ID names (`PLR_ID`, `BZR_ID`, etc.)
2. If not found, analyze column values against known IDs/names from lookup table
3. Return ALL detected levels (data may contain multiple)
4. Claude confirms with user before creating chart

## Tool Interface

### Parameters

```typescript
{
  data: Array<Record<string, any>>,  // Tabular data (not GeoJSON for choropleth)
  chart_type: 'map',
  map_type: 'd3-maps-choropleth',

  // Optional: explicitly select basemap (skips detection)
  basemap?: 'berlin-boroughs' | 'berlin-prognoseraume-2021' |
            'berlin-bezreg-2021' | 'berlin-planungsraeume-2021',

  // Optional: specify which column contains region IDs/names
  region_column?: string,

  // Optional: specify which column contains values to visualize
  value_column?: string,

  title?: string,
  description?: string,
  source_dataset_id?: string
}
```

### Behavior

- If `basemap` not provided → auto-detect and return detection info in response
- If `basemap` provided → use it directly, skip detection
- `region_column` and `value_column` are optional hints (auto-inferred if not provided)

### Response (Auto-Detection Mode)

```
✅ Detected Berlin Planungsräume data (542 regions)

Available aggregation levels:
- Planungsräume (current, 542 regions)
- Bezirksregionen (142 regions) - requires aggregation
- Prognoseräume (58 regions) - requires aggregation
- Bezirke (12 regions) - requires aggregation

To create the map, call again with basemap parameter, or ask user to confirm.
```

## Error Handling

### Error Scenarios

1. **No region column detected**
   - "Could not detect Berlin region data. Please ensure data contains a column with Bezirke, Prognoseräume, Bezirksregionen, or Planungsräume identifiers."

2. **Partial matches** (some values match, some don't)
   - Warning with match rate: "Matched 45/50 rows to Bezirksregionen. 5 unmatched values: [list]. Unmatched regions will appear empty on map."

3. **No numeric column for values**
   - "Choropleth maps require at least one numeric column for visualization."

4. **Multiple numeric columns**
   - Auto-select first numeric column, mention in response: "Using 'population' column for map values. Other available: 'area_km2', 'density'"

5. **Aggregation requested but not possible**
   - "Cannot aggregate to Bezirke - data doesn't include BEZ_ID column. Please add district information or choose Planungsräume level."

### Validation Requirements

- At least one region column detected
- At least one numeric column present
- Region values have reasonable match rate (>50%) against lookup table

## Implementation Components

### New Files

**`src/basemap-matcher.ts`**
- Load LOR lookup data from CSV at startup
- `detectAvailableLevels(data)` → returns all LOR levels found in data
- `matchBasemap(data, level)` → returns basemap ID, key attribute, and region column
- Handle BEZ_ID padding (2→3 digits)

### Modified Files

**`src/index.ts`**
- Change choropleth handling: accept tabular data instead of GeoJSON
- Set correct metadata: `visualize.basemap`, `axes.keys`, `axes.values`
- Return detection info when basemap auto-detected

**`src/chart-builder.ts`**
- Remove GeoJSON processing for choropleth (keep for symbol maps)
- Add validation for choropleth tabular data

**`src/types.ts`**
- Add `basemap`, `region_column`, `value_column` parameters
- Add types for detection result

## Out of Scope

- Automatic data aggregation (Claude handles this via code execution)
- Ortsteile basemap (not in LOR lookup table)
- Custom GeoJSON/TopoJSON upload (use symbol maps for custom geometries)

## Data Source

LOR lookup table: `data/LOR_2023_Übersicht-Tabelle 1.csv`

Columns used:
- `BEZ_ID`, `BEZ` (Bezirke)
- `PGR_ID`, `PGR` (Prognoseräume)
- `BZR_ID`, `BZR` (Bezirksregionen)
- `PLR_ID`, `PLR` (Planungsräume)

## Verification Results

ID matching against Datawrapper basemaps:

| Basemap | Match Rate |
|---------|------------|
| `berlin-boroughs` | 12/12 (100%) with padding |
| `berlin-prognoseraume-2021` | 58/58 (100%) |
| `berlin-bezreg-2021` | 143/143 (100%) |
| `berlin-planungsraeume-2021` | 542/542 (100%) |
