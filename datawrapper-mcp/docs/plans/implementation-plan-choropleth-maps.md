# Choropleth Maps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable choropleth map creation using Datawrapper's predefined Berlin basemaps with auto-detection of LOR regions and user confirmation.

**Architecture:** Add a `BasemapMatcher` class that loads LOR lookup data and detects Berlin region columns in input data. Modify the visualization tool to accept tabular data for choropleth maps (instead of GeoJSON), auto-detect the LOR level, and return detection results for Claude to confirm with the user before creating the map.

**Tech Stack:** TypeScript, Node.js, Datawrapper API

---

## Task 1: Add New Types

**Files:**
- Modify: `src/types.ts`

**Step 1: Add basemap and detection types to types.ts**

Add the following types after the existing `CreateVisualizationParams` interface (around line 31):

```typescript
export type BerlinBasemap =
  | 'berlin-boroughs'
  | 'berlin-prognoseraume-2021'
  | 'berlin-bezreg-2021'
  | 'berlin-planungsraeume-2021';

export interface LORLevel {
  basemap: BerlinBasemap;
  idColumn: string;        // Column name in data (e.g., 'BEZ_ID')
  idKey: string;           // Datawrapper key attribute (e.g., 'Gemeinde_s')
  nameColumn: string;      // Column name for names (e.g., 'BEZ')
  nameKey: string;         // Datawrapper name key (e.g., 'Gemeinde_n')
  label: string;           // Human-readable label (e.g., 'Bezirke')
  count: number;           // Number of regions
}

export interface DetectionResult {
  detected: boolean;
  primaryLevel?: LORLevel;
  allLevels: LORLevel[];
  regionColumn: string;
  valueColumn?: string;
  matchedRows: number;
  totalRows: number;
  unmatchedValues?: string[];
}
```

**Step 2: Update CreateVisualizationParams interface**

Modify the existing `CreateVisualizationParams` interface to add the new optional parameters:

```typescript
export interface CreateVisualizationParams {
  data: Array<Record<string, any>> | GeoJSON;
  chart_type: ChartType;
  variant?: ChartVariant;
  map_type?: MapType;
  basemap?: BerlinBasemap;      // NEW: explicit basemap selection
  region_column?: string;        // NEW: column with region IDs/names
  value_column?: string;         // NEW: column with values to visualize
  title?: string;
  description?: string;
  source_dataset_id?: string;
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build`

Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add types for choropleth basemap detection"
```

---

## Task 2: Create BasemapMatcher Class

**Files:**
- Create: `src/basemap-matcher.ts`

**Step 1: Create the basemap-matcher.ts file**

```typescript
// ABOUTME: Detects Berlin LOR regions in data and matches to Datawrapper basemaps
// ABOUTME: Loads LOR lookup table and provides detection/matching functions

import * as fs from 'fs';
import * as path from 'path';
import { BerlinBasemap, LORLevel, DetectionResult } from './types.js';

const LOR_LEVELS: LORLevel[] = [
  {
    basemap: 'berlin-planungsraeume-2021',
    idColumn: 'PLR_ID',
    idKey: 'PLR_ID',
    nameColumn: 'PLR',
    nameKey: 'PLR_NAME',
    label: 'Planungsräume',
    count: 542
  },
  {
    basemap: 'berlin-bezreg-2021',
    idColumn: 'BZR_ID',
    idKey: 'BZR_ID',
    nameColumn: 'BZR',
    nameKey: 'BZR_NAME',
    label: 'Bezirksregionen',
    count: 143
  },
  {
    basemap: 'berlin-prognoseraume-2021',
    idColumn: 'PGR_ID',
    idKey: 'PGR_ID',
    nameColumn: 'PGR',
    nameKey: 'PGR_NAME',
    label: 'Prognoseräume',
    count: 58
  },
  {
    basemap: 'berlin-boroughs',
    idColumn: 'BEZ_ID',
    idKey: 'Gemeinde_s',
    nameColumn: 'BEZ',
    nameKey: 'Gemeinde_n',
    label: 'Bezirke',
    count: 12
  }
];

export class BasemapMatcher {
  private lorData: Map<string, Set<string>> = new Map();
  private initialized = false;

  constructor() {
    this.loadLORData();
  }

  private loadLORData(): void {
    try {
      const csvPath = path.resolve(process.cwd(), 'data/LOR_2023_Übersicht-Tabelle 1.csv');

      if (!fs.existsSync(csvPath)) {
        console.error(`LOR data file not found at: ${csvPath}`);
        return;
      }

      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.replace(/\r/g, '').split('\n');

      // Line 0 is "Tabelle 1", line 1 is header
      const header = lines[1].split(';');

      // Initialize sets for each column
      const columns = ['BEZ', 'BEZ_ID', 'PGR', 'PGR_ID', 'BZR', 'BZR_ID', 'PLR', 'PLR_ID'];
      for (const col of columns) {
        this.lorData.set(col, new Set<string>());
      }

      // Parse data rows
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(';');
        for (const col of columns) {
          const colIndex = header.indexOf(col);
          if (colIndex >= 0 && values[colIndex]) {
            this.lorData.set(col, this.lorData.get(col)!.add(values[colIndex]));
          }
        }
      }

      this.initialized = true;
      console.error(`BasemapMatcher: Loaded LOR data with ${this.lorData.get('BEZ')?.size} Bezirke, ${this.lorData.get('PLR')?.size} Planungsräume`);
    } catch (error) {
      console.error('Failed to load LOR data:', error);
    }
  }

  getLORLevels(): LORLevel[] {
    return LOR_LEVELS;
  }

  getLevelByBasemap(basemap: BerlinBasemap): LORLevel | undefined {
    return LOR_LEVELS.find(l => l.basemap === basemap);
  }

  detectAvailableLevels(data: Array<Record<string, any>>): DetectionResult {
    if (!this.initialized || data.length === 0) {
      return {
        detected: false,
        allLevels: [],
        regionColumn: '',
        matchedRows: 0,
        totalRows: data.length
      };
    }

    const columns = Object.keys(data[0]);
    const detectedLevels: LORLevel[] = [];
    let primaryLevel: LORLevel | undefined;
    let regionColumn = '';
    let matchedRows = 0;
    let unmatchedValues: string[] = [];

    // Check each LOR level (most granular first)
    for (const level of LOR_LEVELS) {
      // Check for ID column match
      const idColMatch = this.findMatchingColumn(data, columns, level.idColumn, level);
      if (idColMatch.matched) {
        detectedLevels.push(level);
        if (!primaryLevel) {
          primaryLevel = level;
          regionColumn = idColMatch.column;
          matchedRows = idColMatch.matchedRows;
          unmatchedValues = idColMatch.unmatchedValues;
        }
        continue;
      }

      // Check for name column match
      const nameColMatch = this.findMatchingColumn(data, columns, level.nameColumn, level);
      if (nameColMatch.matched) {
        detectedLevels.push(level);
        if (!primaryLevel) {
          primaryLevel = level;
          regionColumn = nameColMatch.column;
          matchedRows = nameColMatch.matchedRows;
          unmatchedValues = nameColMatch.unmatchedValues;
        }
      }
    }

    // Find first numeric column for values
    let valueColumn: string | undefined;
    for (const col of columns) {
      if (typeof data[0][col] === 'number') {
        valueColumn = col;
        break;
      }
    }

    return {
      detected: detectedLevels.length > 0,
      primaryLevel,
      allLevels: detectedLevels,
      regionColumn,
      valueColumn,
      matchedRows,
      totalRows: data.length,
      unmatchedValues: unmatchedValues.length > 0 ? unmatchedValues : undefined
    };
  }

  private findMatchingColumn(
    data: Array<Record<string, any>>,
    columns: string[],
    targetColumn: string,
    level: LORLevel
  ): { matched: boolean; column: string; matchedRows: number; unmatchedValues: string[] } {
    // First, check for exact column name match
    if (columns.includes(targetColumn)) {
      const result = this.checkColumnValues(data, targetColumn, level);
      if (result.matchRate > 0.5) {
        return { matched: true, column: targetColumn, ...result };
      }
    }

    // Check all columns for value matches
    for (const col of columns) {
      const result = this.checkColumnValues(data, col, level);
      if (result.matchRate > 0.5) {
        return { matched: true, column: col, ...result };
      }
    }

    return { matched: false, column: '', matchedRows: 0, unmatchedValues: [] };
  }

  private checkColumnValues(
    data: Array<Record<string, any>>,
    column: string,
    level: LORLevel
  ): { matchRate: number; matchedRows: number; unmatchedValues: string[] } {
    const idSet = this.lorData.get(level.idColumn);
    const nameSet = this.lorData.get(level.nameColumn);

    let matchedRows = 0;
    const unmatchedValues: string[] = [];

    for (const row of data) {
      const value = String(row[column] ?? '');
      if (!value) continue;

      // For BEZ_ID, need to pad 2-digit to 3-digit for Datawrapper
      let normalizedValue = value;
      if (level.basemap === 'berlin-boroughs' && /^\d{2}$/.test(value)) {
        normalizedValue = '0' + value;
      }

      if (idSet?.has(value) || idSet?.has(normalizedValue) || nameSet?.has(value)) {
        matchedRows++;
      } else {
        if (unmatchedValues.length < 5) {
          unmatchedValues.push(value);
        }
      }
    }

    return {
      matchRate: data.length > 0 ? matchedRows / data.length : 0,
      matchedRows,
      unmatchedValues
    };
  }

  padBezirkId(id: string): string {
    // Pad 2-digit BEZ_ID to 3-digit for Datawrapper
    if (/^\d{2}$/.test(id)) {
      return '0' + id;
    }
    return id;
  }

  isUsingIds(data: Array<Record<string, any>>, regionColumn: string, level: LORLevel): boolean {
    if (data.length === 0) return false;
    const firstValue = String(data[0][regionColumn] ?? '');
    const idSet = this.lorData.get(level.idColumn);

    // Check if it looks like an ID (numeric string)
    if (/^\d+$/.test(firstValue)) {
      // For BEZ_ID, also check padded version
      if (level.basemap === 'berlin-boroughs') {
        return idSet?.has(firstValue) || idSet?.has(this.padBezirkId(firstValue)) || false;
      }
      return idSet?.has(firstValue) || false;
    }
    return false;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build`

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/basemap-matcher.ts
git commit -m "feat: add BasemapMatcher for LOR region detection"
```

---

## Task 3: Create Unit Tests for BasemapMatcher

**Files:**
- Create: `src/tests/basemap-matcher.test.ts`

**Step 1: Create test file**

```typescript
// ABOUTME: Unit tests for BasemapMatcher class
// ABOUTME: Run with: npm run build && node dist/tests/basemap-matcher.test.js

import { BasemapMatcher } from '../basemap-matcher.js';

const matcher = new BasemapMatcher();

// Test data for different LOR levels
const bezirkeDataById = [
  { BEZ_ID: '01', population: 384000 },
  { BEZ_ID: '02', population: 289000 },
  { BEZ_ID: '03', population: 407000 },
];

const bezirkeDataByName = [
  { district: 'Mitte', population: 384000 },
  { district: 'Friedrichshain-Kreuzberg', population: 289000 },
  { district: 'Pankow', population: 407000 },
];

const prognoseraeumeData = [
  { PGR_ID: '0110', value: 100 },
  { PGR_ID: '0120', value: 200 },
  { PGR_ID: '0130', value: 150 },
];

const bezirksregionenData = [
  { BZR_ID: '011001', count: 50 },
  { BZR_ID: '011002', count: 75 },
  { BZR_ID: '012005', count: 60 },
];

const planungsraeumeData = [
  { PLR_ID: '01100101', metric: 10 },
  { PLR_ID: '01100102', metric: 20 },
  { PLR_ID: '01100103', metric: 15 },
];

const mixedData = [
  { BEZ_ID: '01', BZR_ID: '011001', value: 100 },
  { BEZ_ID: '01', BZR_ID: '011002', value: 200 },
  { BEZ_ID: '02', BZR_ID: '021001', value: 150 },
];

const noMatchData = [
  { region: 'Unknown1', value: 100 },
  { region: 'Unknown2', value: 200 },
];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error: any) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(actual: boolean, message?: string) {
  if (!actual) {
    throw new Error(message || 'Expected true but got false');
  }
}

console.log('\nBasemapMatcher Unit Tests\n' + '='.repeat(50));

test('detects Bezirke by ID column', () => {
  const result = matcher.detectAvailableLevels(bezirkeDataById);
  assertTrue(result.detected, 'Should detect regions');
  assertEqual(result.primaryLevel?.basemap, 'berlin-boroughs', 'Should detect berlin-boroughs');
  assertEqual(result.regionColumn, 'BEZ_ID', 'Should identify BEZ_ID column');
});

test('detects Bezirke by name', () => {
  const result = matcher.detectAvailableLevels(bezirkeDataByName);
  assertTrue(result.detected, 'Should detect regions');
  assertEqual(result.primaryLevel?.basemap, 'berlin-boroughs', 'Should detect berlin-boroughs');
});

test('detects Prognoseräume', () => {
  const result = matcher.detectAvailableLevels(prognoseraeumeData);
  assertTrue(result.detected, 'Should detect regions');
  assertEqual(result.primaryLevel?.basemap, 'berlin-prognoseraume-2021', 'Should detect prognoseraume');
  assertEqual(result.regionColumn, 'PGR_ID', 'Should identify PGR_ID column');
});

test('detects Bezirksregionen', () => {
  const result = matcher.detectAvailableLevels(bezirksregionenData);
  assertTrue(result.detected, 'Should detect regions');
  assertEqual(result.primaryLevel?.basemap, 'berlin-bezreg-2021', 'Should detect bezreg');
  assertEqual(result.regionColumn, 'BZR_ID', 'Should identify BZR_ID column');
});

test('detects Planungsräume', () => {
  const result = matcher.detectAvailableLevels(planungsraeumeData);
  assertTrue(result.detected, 'Should detect regions');
  assertEqual(result.primaryLevel?.basemap, 'berlin-planungsraeume-2021', 'Should detect planungsraeume');
  assertEqual(result.regionColumn, 'PLR_ID', 'Should identify PLR_ID column');
});

test('detects multiple levels in mixed data', () => {
  const result = matcher.detectAvailableLevels(mixedData);
  assertTrue(result.detected, 'Should detect regions');
  assertTrue(result.allLevels.length >= 2, 'Should detect multiple levels');
});

test('finds value column', () => {
  const result = matcher.detectAvailableLevels(bezirkeDataById);
  assertEqual(result.valueColumn, 'population', 'Should find numeric column');
});

test('returns detected=false for unrecognized data', () => {
  const result = matcher.detectAvailableLevels(noMatchData);
  assertTrue(!result.detected, 'Should not detect regions');
  assertEqual(result.allLevels.length, 0, 'Should have no levels');
});

test('pads BEZ_ID correctly', () => {
  assertEqual(matcher.padBezirkId('01'), '001', 'Should pad 01 to 001');
  assertEqual(matcher.padBezirkId('12'), '012', 'Should pad 12 to 012');
  assertEqual(matcher.padBezirkId('001'), '001', 'Should not change 001');
});

test('getLORLevels returns all levels', () => {
  const levels = matcher.getLORLevels();
  assertEqual(levels.length, 4, 'Should have 4 LOR levels');
});

test('getLevelByBasemap returns correct level', () => {
  const level = matcher.getLevelByBasemap('berlin-boroughs');
  assertEqual(level?.label, 'Bezirke', 'Should return Bezirke level');
  assertEqual(level?.count, 12, 'Should have 12 regions');
});

console.log('\n' + '='.repeat(50));
console.log('Tests complete\n');
```

**Step 2: Build and run tests**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build && node dist/tests/basemap-matcher.test.js`

Expected: All tests pass with ✅

**Step 3: Commit**

```bash
git add src/tests/basemap-matcher.test.ts
git commit -m "test: add unit tests for BasemapMatcher"
```

---

## Task 4: Update Tool Schema in index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add import for BasemapMatcher**

Add after line 16 (after the existing imports):

```typescript
import { BasemapMatcher } from './basemap-matcher.js';
```

Also update the types import to include the new types:

```typescript
import { CreateVisualizationParams, ChartType, ChartVariant, GeoJSON, BerlinBasemap } from './types.js';
```

**Step 2: Initialize BasemapMatcher**

Add after line 79 (after `const chartLogger = new ChartLogger(CHART_LOG_PATH);`):

```typescript
const basemapMatcher = new BasemapMatcher();
```

**Step 3: Update the tool schema**

Replace the `CREATE_VISUALIZATION_TOOL` definition (lines 95-149) with:

```typescript
const CREATE_VISUALIZATION_TOOL: Tool = {
  name: 'create_visualization',
  description: 'Create a data visualization using the Datawrapper API. Supports bar, column, line, area, scatter, dot, range, arrow, pie, donut, election-donut, table, and map charts. Use "variant" for bar (basic/stacked/split) and column (basic/grouped/stacked) charts. **For maps, map_type is REQUIRED**: "d3-maps-symbols" (points with GeoJSON) or "d3-maps-choropleth" (regions with tabular data). **For choropleth maps**: provide tabular data with Berlin region identifiers (Bezirke, Prognoseräume, Bezirksregionen, or Planungsräume). If basemap is not specified, the tool will auto-detect and return available options.',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        description: 'Array of data objects. For choropleth maps: tabular data with region IDs/names. For symbol maps: GeoJSON FeatureCollection.',
        oneOf: [
          {
            type: 'array',
            items: {
              type: 'object'
            }
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['FeatureCollection'] },
              features: { type: 'array' }
            }
          }
        ]
      },
      chart_type: {
        type: 'string',
        enum: ['bar', 'column', 'line', 'area', 'scatter', 'dot', 'range', 'arrow', 'pie', 'donut', 'election-donut', 'table', 'map'],
        description: 'Type of visualization to create'
      },
      variant: {
        type: 'string',
        enum: ['basic', 'stacked', 'grouped', 'split'],
        description: 'Chart variant. For bar: basic (default), stacked, split. For column: basic (default), grouped, stacked.'
      },
      map_type: {
        type: 'string',
        enum: ['d3-maps-symbols', 'd3-maps-choropleth'],
        description: 'REQUIRED when chart_type is "map". "d3-maps-symbols" for point locations (requires GeoJSON), "d3-maps-choropleth" for region comparison (requires tabular data with Berlin region identifiers).'
      },
      basemap: {
        type: 'string',
        enum: ['berlin-boroughs', 'berlin-prognoseraume-2021', 'berlin-bezreg-2021', 'berlin-planungsraeume-2021'],
        description: 'For choropleth maps: explicitly select basemap. If omitted, auto-detects from data and returns options for confirmation.'
      },
      region_column: {
        type: 'string',
        description: 'For choropleth maps: column name containing region IDs or names. Auto-detected if omitted.'
      },
      value_column: {
        type: 'string',
        description: 'For choropleth maps: column name containing values to visualize. Auto-detected if omitted.'
      },
      title: {
        type: 'string',
        description: 'Optional chart title (auto-generated if omitted)'
      },
      description: {
        type: 'string',
        description: 'Optional chart description/byline'
      },
      source_dataset_id: {
        type: 'string',
        description: 'Optional Berlin dataset ID for tracking'
      }
    },
    required: ['data', 'chart_type']
  }
};
```

**Step 4: Verify TypeScript compiles**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build`

Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: update tool schema with choropleth basemap parameters"
```

---

## Task 5: Implement Choropleth Map Handler

**Files:**
- Modify: `src/index.ts`

**Step 1: Add choropleth detection handler function**

Add after the `getDefaultVisualizeSettings` function (around line 63), before `dotenv.config()`:

```typescript
/**
 * Handle choropleth map detection - returns detection info without creating chart
 */
function formatDetectionResponse(detection: import('./types.js').DetectionResult): string {
  if (!detection.detected) {
    return `❌ Could not detect Berlin region data.

Please ensure your data contains a column with one of:
- Bezirk IDs (BEZ_ID) or names (e.g., "Mitte", "Pankow")
- Prognoseraum IDs (PGR_ID) or names
- Bezirksregion IDs (BZR_ID) or names
- Planungsraum IDs (PLR_ID) or names

Found columns: ${Object.keys(detection.totalRows > 0 ? {} : {}).join(', ') || 'none'}`;
  }

  const primary = detection.primaryLevel!;
  let response = `✅ Detected Berlin ${primary.label} data

**Detected level:** ${primary.label} (${primary.count} regions)
**Region column:** ${detection.regionColumn}
**Value column:** ${detection.valueColumn || 'none found'}
**Match rate:** ${detection.matchedRows}/${detection.totalRows} rows`;

  if (detection.unmatchedValues && detection.unmatchedValues.length > 0) {
    response += `\n**Unmatched values:** ${detection.unmatchedValues.join(', ')}`;
  }

  if (detection.allLevels.length > 1) {
    response += `\n\n**Available aggregation levels:**`;
    for (const level of detection.allLevels) {
      const isCurrent = level.basemap === primary.basemap;
      response += `\n- ${level.label} (${level.count} regions)${isCurrent ? ' ← detected' : ' - requires aggregation'}`;
    }
  }

  response += `\n\n**To create the map**, call again with:
- \`basemap: "${primary.basemap}"\`${detection.allLevels.length > 1 ? ' (or choose another level)' : ''}`;

  return response;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build`

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add choropleth detection response formatter"
```

---

## Task 6: Update handleCreateVisualization for Choropleth

**Files:**
- Modify: `src/index.ts`

**Step 1: Update the handleCreateVisualization function**

Replace the entire `handleCreateVisualization` function (starting around line 172) with the following updated version that handles choropleth maps differently:

```typescript
/**
 * Handle create_visualization tool execution
 */
async function handleCreateVisualization(params: CreateVisualizationParams) {
  try {
    const { data, chart_type, variant, map_type, basemap, region_column, value_column, title, description, source_dataset_id } = params;

    // Validate map_type is provided for maps
    if (chart_type === 'map' && !map_type) {
      throw new Error('map_type is required when chart_type is "map". Choose: (1) "d3-maps-symbols" for point locations (requires GeoJSON), or (2) "d3-maps-choropleth" for region comparison (requires tabular data with Berlin region identifiers).');
    }

    // Handle choropleth maps separately
    if (chart_type === 'map' && map_type === 'd3-maps-choropleth') {
      return await handleChoroplethMap(params);
    }

    // Validate data structure for the chart type
    if (chart_type !== 'map') {
      const dataArray = data as Array<Record<string, any>>;
      const validation = chartBuilder.validateDataForChartType(dataArray, chart_type, variant);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    } else {
      // For symbol maps, use the existing GeoJSON validation
      chartBuilder.validateData(data, chart_type);
    }

    // Infer chart configuration
    const config = chartBuilder.inferChartConfig(data, chart_type, title);

    // Get Datawrapper chart type
    const dwChartType = chart_type === 'map' ? map_type! : chartBuilder.getDatawrapperType(chart_type, variant);

    // Get chart-type-specific visualize settings
    const typeSpecificSettings = getDefaultVisualizeSettings(chart_type, variant);

    // Create initial chart metadata with clean, modern styling
    const metadata: any = {
      visualize: {
        'base-color': '#2A7FFF',
        'thick': false,
        'value-label-format': '0,0.[00]',
        ...typeSpecificSettings,
      },
      publish: chart_type === 'map' ? {
        'embed-width': 600,
        'embed-height': 600
      } : undefined
    };

    if (config.title) {
      metadata.title = config.title;
    }

    // Add description and source information
    if (description || source_dataset_id) {
      metadata.describe = {};
      if (description) {
        metadata.describe.intro = description;
      }
      if (source_dataset_id) {
        metadata.describe['source-name'] = 'Berlin Open Data';
        metadata.describe['source-url'] = `https://daten.berlin.de/datensaetze/${source_dataset_id}`;
      }
    }

    // Add chart-specific configuration
    if (['bar', 'column', 'line', 'area'].includes(chart_type)) {
      if (config.xAxis) {
        metadata.axes = {
          x: config.xAxis
        };
      }
    } else if (chart_type === 'scatter') {
      const dataArray = data as Array<Record<string, any>>;
      const cols = chartBuilder.analyzeColumns(dataArray);
      if (cols.categorical.length > 0 && cols.numeric.length >= 2) {
        metadata.axes = {
          x: cols.numeric[0],
          y: cols.numeric[1],
          labels: cols.categorical[0]
        };
      }
    } else if (chart_type === 'map' && map_type === 'd3-maps-symbols' && config.basemap) {
      metadata.visualize.basemap = config.basemap;
      metadata.visualize['map-type'] = 'map-symbol';
      metadata.visualize['fitcontent'] = false;
    }

    // Create chart
    const variantLabel = variant && variant !== 'basic' ? ` (${variant})` : '';
    const chartTypeLabel = chart_type === 'map' ? `${map_type} map` : `${chart_type}${variantLabel} chart`;
    console.error(`Creating ${chartTypeLabel}...`);
    const chart = await datawrapperClient.createChart(dwChartType, metadata);

    // Prepare and upload data
    let dataString: string;
    let rowCount: number;
    let sampleFeature: any = null;

    if (chart_type === 'map') {
      const geojson = data as GeoJSON;
      rowCount = geojson.features.length;
      sampleFeature = chartBuilder.getSampleFeature(geojson);
      dataString = chartBuilder.processGeoJSON(geojson, map_type!);
    } else {
      const dataArray = data as Array<Record<string, any>>;
      dataString = chartBuilder.formatForDatawrapper(dataArray);
      rowCount = dataArray.length;
    }

    console.error(`Uploading data (${rowCount} rows)...`);
    await datawrapperClient.uploadData(chart.id, dataString);

    // Publish chart
    console.error('Publishing chart...');
    const publishedChart = await datawrapperClient.publishChart(chart.id);

    // Get chart URLs
    const publicId = publishedChart.publicId || chart.id;
    const embedCode = chart_type === 'map'
      ? datawrapperClient.getEmbedCode(publicId, 600, 600)
      : datawrapperClient.getEmbedCode(publicId);
    const publicUrl = datawrapperClient.getPublicUrl(publicId);
    const editUrl = datawrapperClient.getEditUrl(chart.id);

    // Log chart creation asynchronously
    chartLogger.logChart({
      chartId: chart.id,
      url: publicUrl,
      embedCode,
      editUrl,
      chartType: chart_type,
      title: config.title,
      createdAt: new Date().toISOString(),
      sourceDatasetId: source_dataset_id,
      sourceDatasetUrl: source_dataset_id ? `https://daten.berlin.de/datensaetze/${source_dataset_id}` : undefined,
      dataRowCount: rowCount
    }).catch(err => console.error('Background logging failed:', err));

    // Format response
    let responseText = `✅ Chart created successfully!

[CHART:${publicId}]
${embedCode}
[/CHART]

📊 **Chart URL**: ${publicUrl}
✏️ **Edit**: ${editUrl}`;

    if (chart_type === 'map' && sampleFeature) {
      responseText += `

📍 **Map type**: ${map_type}
📦 **Features**: ${rowCount}
🔍 **Sample feature**:
\`\`\`json
${JSON.stringify(sampleFeature, null, 2)}
\`\`\``;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  } catch (error: any) {
    console.error('Error creating visualization:', error);

    return {
      content: [
        {
          type: 'text',
          text: `❌ ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Handle choropleth map creation with Berlin basemaps
 */
async function handleChoroplethMap(params: CreateVisualizationParams) {
  const { data, basemap, region_column, value_column, title, description, source_dataset_id } = params;

  // Choropleth maps require tabular data, not GeoJSON
  if (!Array.isArray(data)) {
    throw new Error('Choropleth maps require tabular data (array of objects), not GeoJSON. For GeoJSON point data, use map_type: "d3-maps-symbols" instead.');
  }

  const dataArray = data as Array<Record<string, any>>;

  if (dataArray.length === 0) {
    throw new Error('Cannot create choropleth map: Data array is empty.');
  }

  // Detect available LOR levels
  const detection = basemapMatcher.detectAvailableLevels(dataArray);

  // If no basemap specified, return detection info for user confirmation
  if (!basemap) {
    return {
      content: [
        {
          type: 'text',
          text: formatDetectionResponse(detection)
        }
      ]
    };
  }

  // Validate specified basemap
  const level = basemapMatcher.getLevelByBasemap(basemap);
  if (!level) {
    throw new Error(`Unknown basemap: ${basemap}. Valid options: berlin-boroughs, berlin-prognoseraume-2021, berlin-bezreg-2021, berlin-planungsraeume-2021`);
  }

  // Determine region column
  const regionCol = region_column || detection.regionColumn;
  if (!regionCol) {
    throw new Error(`Could not detect region column for ${level.label}. Please specify region_column parameter.`);
  }

  // Determine value column
  const valueCol = value_column || detection.valueColumn;
  if (!valueCol) {
    throw new Error('Choropleth maps require at least one numeric column for visualization. Please specify value_column parameter.');
  }

  // Check if using IDs or names
  const usingIds = basemapMatcher.isUsingIds(dataArray, regionCol, level);
  const keyAttr = usingIds ? level.idKey : level.nameKey;

  // Prepare data - transform region column if needed (BEZ_ID padding)
  let processedData = dataArray;
  if (usingIds && basemap === 'berlin-boroughs') {
    processedData = dataArray.map(row => ({
      ...row,
      [regionCol]: basemapMatcher.padBezirkId(String(row[regionCol]))
    }));
  }

  // Build metadata for choropleth map
  const metadata: any = {
    title: title || `${level.label} Map`,
    visualize: {
      basemap: basemap,
      'map-key-attr': keyAttr,
    },
    axes: {
      keys: regionCol,
      values: valueCol
    },
    publish: {
      'embed-width': 600,
      'embed-height': 600
    }
  };

  // Add description and source
  if (description || source_dataset_id) {
    metadata.describe = {};
    if (description) {
      metadata.describe.intro = description;
    }
    if (source_dataset_id) {
      metadata.describe['source-name'] = 'Berlin Open Data';
      metadata.describe['source-url'] = `https://daten.berlin.de/datensaetze/${source_dataset_id}`;
    }
  }

  // Create chart
  console.error(`Creating choropleth map with ${basemap}...`);
  const chart = await datawrapperClient.createChart('d3-maps-choropleth', metadata);

  // Convert data to CSV and upload
  const csvData = chartBuilder.formatForDatawrapper(processedData);
  console.error(`Uploading data (${processedData.length} rows)...`);
  await datawrapperClient.uploadData(chart.id, csvData);

  // Publish chart
  console.error('Publishing chart...');
  const publishedChart = await datawrapperClient.publishChart(chart.id);

  // Get chart URLs
  const publicId = publishedChart.publicId || chart.id;
  const embedCode = datawrapperClient.getEmbedCode(publicId, 600, 600);
  const publicUrl = datawrapperClient.getPublicUrl(publicId);
  const editUrl = datawrapperClient.getEditUrl(chart.id);

  // Log chart creation
  chartLogger.logChart({
    chartId: chart.id,
    url: publicUrl,
    embedCode,
    editUrl,
    chartType: 'map',
    title: metadata.title,
    createdAt: new Date().toISOString(),
    sourceDatasetId: source_dataset_id,
    sourceDatasetUrl: source_dataset_id ? `https://daten.berlin.de/datensaetze/${source_dataset_id}` : undefined,
    dataRowCount: processedData.length
  }).catch(err => console.error('Background logging failed:', err));

  // Format response
  const responseText = `✅ Choropleth map created successfully!

[CHART:${publicId}]
${embedCode}
[/CHART]

📊 **Chart URL**: ${publicUrl}
✏️ **Edit**: ${editUrl}

🗺️ **Basemap**: ${basemap} (${level.label})
📍 **Region column**: ${regionCol} (using ${usingIds ? 'IDs' : 'names'})
📈 **Value column**: ${valueCol}
📦 **Regions**: ${processedData.length}`;

  return {
    content: [
      {
        type: 'text',
        text: responseText
      }
    ]
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build`

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: implement choropleth map handler with basemap detection"
```

---

## Task 7: Create Integration Test for Choropleth Maps

**Files:**
- Create: `src/tests/test-choropleth-maps.ts`

**Step 1: Create integration test file**

```typescript
// ABOUTME: Integration test for choropleth map creation via Datawrapper API
// ABOUTME: Run with: npm run build && node dist/tests/test-choropleth-maps.js

import * as dotenv from 'dotenv';
import { DatawrapperClient } from '../datawrapper-client.js';
import { ChartBuilder } from '../chart-builder.js';
import { BasemapMatcher } from '../basemap-matcher.js';

dotenv.config();

const API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;
if (!API_TOKEN) {
  console.error('DATAWRAPPER_API_TOKEN required');
  process.exit(1);
}

const client = new DatawrapperClient(API_TOKEN);
const builder = new ChartBuilder();
const matcher = new BasemapMatcher();

// Test data for Berlin Bezirke
const bezirkeData = [
  { BEZ_ID: '01', name: 'Mitte', population: 384000 },
  { BEZ_ID: '02', name: 'Friedrichshain-Kreuzberg', population: 289000 },
  { BEZ_ID: '03', name: 'Pankow', population: 407000 },
  { BEZ_ID: '04', name: 'Charlottenburg-Wilmersdorf', population: 342000 },
  { BEZ_ID: '05', name: 'Spandau', population: 243000 },
  { BEZ_ID: '06', name: 'Steglitz-Zehlendorf', population: 308000 },
  { BEZ_ID: '07', name: 'Tempelhof-Schöneberg', population: 351000 },
  { BEZ_ID: '08', name: 'Neukölln', population: 327000 },
  { BEZ_ID: '09', name: 'Treptow-Köpenick', population: 271000 },
  { BEZ_ID: '10', name: 'Marzahn-Hellersdorf', population: 269000 },
  { BEZ_ID: '11', name: 'Lichtenberg', population: 296000 },
  { BEZ_ID: '12', name: 'Reinickendorf', population: 265000 },
];

async function testChoroplethMap() {
  console.log('Testing Choropleth Map with Berlin Bezirke\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Detection
    console.log('\n1. Detecting LOR level...');
    const detection = matcher.detectAvailableLevels(bezirkeData);
    console.log(`   Detected: ${detection.detected}`);
    console.log(`   Primary level: ${detection.primaryLevel?.label}`);
    console.log(`   Region column: ${detection.regionColumn}`);
    console.log(`   Value column: ${detection.valueColumn}`);
    console.log(`   Match rate: ${detection.matchedRows}/${detection.totalRows}`);

    if (!detection.detected) {
      throw new Error('Failed to detect LOR level');
    }

    // Step 2: Determine basemap settings
    console.log('\n2. Configuring basemap...');
    const level = detection.primaryLevel!;
    const usingIds = matcher.isUsingIds(bezirkeData, detection.regionColumn, level);
    const keyAttr = usingIds ? level.idKey : level.nameKey;
    console.log(`   Basemap: ${level.basemap}`);
    console.log(`   Using: ${usingIds ? 'IDs' : 'names'}`);
    console.log(`   Key attribute: ${keyAttr}`);

    // Step 3: Process data (pad BEZ_ID for berlin-boroughs)
    console.log('\n3. Processing data...');
    let processedData = bezirkeData;
    if (usingIds && level.basemap === 'berlin-boroughs') {
      processedData = bezirkeData.map(row => ({
        ...row,
        BEZ_ID: matcher.padBezirkId(String(row.BEZ_ID))
      }));
      console.log(`   Padded BEZ_ID: ${bezirkeData[0].BEZ_ID} → ${processedData[0].BEZ_ID}`);
    }

    // Step 4: Create chart
    console.log('\n4. Creating chart...');
    const metadata = {
      title: 'Berlin Population by District',
      visualize: {
        basemap: level.basemap,
        'map-key-attr': keyAttr,
      },
      axes: {
        keys: detection.regionColumn,
        values: detection.valueColumn
      },
      publish: {
        'embed-width': 600,
        'embed-height': 600
      }
    };
    console.log(`   Metadata:`, JSON.stringify(metadata, null, 2));

    const chart = await client.createChart('d3-maps-choropleth', metadata);
    console.log(`   Chart ID: ${chart.id}`);

    // Step 5: Upload data
    console.log('\n5. Uploading CSV data...');
    const csvData = builder.formatForDatawrapper(processedData);
    console.log(`   CSV preview:\n${csvData.split('\n').slice(0, 3).join('\n')}`);
    await client.uploadData(chart.id, csvData);
    console.log('   Data uploaded');

    // Step 6: Publish
    console.log('\n6. Publishing chart...');
    const published = await client.publishChart(chart.id);
    const publicId = published.publicId || chart.id;
    const publicUrl = client.getPublicUrl(publicId);
    const editUrl = client.getEditUrl(chart.id);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ SUCCESS!');
    console.log(`   Public URL: ${publicUrl}`);
    console.log(`   Edit URL: ${editUrl}`);

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.log('\n' + '='.repeat(60));
    console.log('\n❌ FAILED!');
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return { success: false, error: error.message };
  }
}

testChoroplethMap().catch(console.error);
```

**Step 2: Build and run integration test**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build && node dist/tests/test-choropleth-maps.js`

Expected: Test passes and creates a choropleth map, outputs a public URL

**Step 3: Commit**

```bash
git add src/tests/test-choropleth-maps.ts
git commit -m "test: add integration test for choropleth maps"
```

---

## Task 8: Clean Up Test Files

**Files:**
- Delete: `src/tests/test-choropleth.ts` (old broken test)
- Delete: `src/tests/find-berlin-basemaps.ts` (investigation script)
- Delete: `src/tests/verify-basemap-keys.ts` (investigation script)
- Delete: `src/tests/get-basemap-keys.ts` (if exists)

**Step 1: Remove old test files**

Run:
```bash
cd /Users/alsino/Desktop/ODIS/datawrapper-mcp
rm -f src/tests/test-choropleth.ts
rm -f src/tests/find-berlin-basemaps.ts
rm -f src/tests/verify-basemap-keys.ts
rm -f src/tests/get-basemap-keys.ts
```

**Step 2: Rebuild to remove from dist**

Run: `npm run build`

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove investigation test files"
```

---

## Task 9: Final Verification

**Step 1: Run full build**

Run: `cd /Users/alsino/Desktop/ODIS/datawrapper-mcp && npm run build`

Expected: No errors

**Step 2: Run unit tests**

Run: `node dist/tests/basemap-matcher.test.js`

Expected: All tests pass

**Step 3: Run integration test**

Run: `node dist/tests/test-choropleth-maps.js`

Expected: Creates a real choropleth map, outputs URL

**Step 4: Verify the created map**

Open the public URL in browser and verify:
- Map shows Berlin districts
- Colors represent population values
- Hovering shows district names and values

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete choropleth map implementation with Berlin basemaps"
```

---

## Summary

This plan implements:

1. **New types** for basemap detection (`BerlinBasemap`, `LORLevel`, `DetectionResult`)
2. **BasemapMatcher class** that loads LOR lookup data and detects region columns
3. **Updated tool schema** with `basemap`, `region_column`, `value_column` parameters
4. **Choropleth handler** that:
   - Returns detection info when no basemap specified (for user confirmation)
   - Creates maps when basemap is explicitly provided
   - Handles BEZ_ID padding automatically
   - Sets correct Datawrapper metadata (`visualize.basemap`, `axes.keys`, `axes.values`)
5. **Unit tests** for BasemapMatcher
6. **Integration test** for end-to-end choropleth map creation
