# Extended Chart Types - Implementation Plan

## Overview

This document provides a step-by-step implementation guide for extending the Datawrapper MCP server with additional chart types. The MVP (bar, line, map) is already implemented; this plan covers adding the remaining chart types.

---

## Current State

### Already Implemented
- Basic bar chart (`d3-bars`)
- Line chart (`d3-lines`)
- Maps (`d3-maps-symbols`, `d3-maps-choropleth`)
- Smart defaults for title, axes, labels
- Chart logging with provenance tracking
- Integration with interface-prototype

### To Be Added
- Bar variants: stacked, split
- Column charts: basic, grouped, stacked
- Area chart
- Scatter plot, dot plot, range plot, arrow plot
- Pie chart, donut chart, election donut
- Table

---

## Implementation Steps

### Step 1: Update Type Definitions

**File**: `src/types.ts`

**Changes**:

```typescript
// Update ChartType to include all chart types
export type ChartType =
  | 'bar'
  | 'column'
  | 'line'
  | 'area'
  | 'scatter'
  | 'dot'
  | 'range'
  | 'arrow'
  | 'pie'
  | 'donut'
  | 'election-donut'
  | 'table'
  | 'map';

// Add variant type
export type ChartVariant = 'basic' | 'stacked' | 'grouped' | 'split';

// Update ChartData interface
export interface ChartData {
  data: Array<Record<string, any>> | GeoJSONFeatureCollection;
  chart_type: ChartType;
  variant?: ChartVariant;
  map_type?: 'd3-maps-symbols' | 'd3-maps-choropleth';
  title?: string;
  description?: string;
  source_dataset_id?: string;
}

// Update ChartLogEntry
export interface ChartLogEntry {
  chartId: string;
  url: string;
  embedCode: string;
  editUrl: string;
  chartType: string;  // Datawrapper type string
  variant?: string;
  title: string;
  createdAt: string;
  sourceDatasetId?: string;
  sourceDatasetUrl?: string;
  dataRowCount: number;
}
```

**Commit after completing this step.**

---

### Step 2: Add Datawrapper Type Mapping

**File**: `src/chart-builder.ts`

**Add mapping constant**:

```typescript
// Map our interface to Datawrapper type strings
const DATAWRAPPER_TYPE_MAP: Record<string, Record<string, string>> = {
  bar: {
    basic: 'd3-bars',
    stacked: 'd3-bars-stacked',
    split: 'd3-bars-split',
  },
  column: {
    basic: 'column-chart',
    grouped: 'grouped-column-chart',
    stacked: 'stacked-column-chart',
  },
  line: {
    basic: 'd3-lines',
  },
  area: {
    basic: 'd3-area',
  },
  scatter: {
    basic: 'd3-scatter-plot',
  },
  dot: {
    basic: 'd3-dot-plot',
  },
  range: {
    basic: 'd3-range-plot',
  },
  arrow: {
    basic: 'd3-arrow-plot',
  },
  pie: {
    basic: 'd3-pies',
  },
  donut: {
    basic: 'd3-donuts',
  },
  'election-donut': {
    basic: 'election-donut-chart',
  },
  table: {
    basic: 'tables',
  },
};

/**
 * Get Datawrapper type string from our chart_type and variant
 */
function getDatawrapperType(chartType: ChartType, variant?: ChartVariant): string {
  const typeMap = DATAWRAPPER_TYPE_MAP[chartType];
  if (!typeMap) {
    throw new Error(`Unknown chart type: ${chartType}`);
  }

  const v = variant || 'basic';
  const dwType = typeMap[v];
  if (!dwType) {
    throw new Error(`Invalid variant '${v}' for chart type '${chartType}'`);
  }

  return dwType;
}
```

**Commit after completing this step.**

---

### Step 3: Add Data Validation Functions

**File**: `src/chart-builder.ts`

**Add validation function**:

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface ColumnAnalysis {
  categorical: string[];
  numeric: string[];
  date: string[];
}

/**
 * Analyze column types in data
 */
function analyzeColumns(data: Array<Record<string, any>>): ColumnAnalysis {
  if (data.length === 0) {
    return { categorical: [], numeric: [], date: [] };
  }

  const result: ColumnAnalysis = { categorical: [], numeric: [], date: [] };
  const sample = data[0];

  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === 'number') {
      result.numeric.push(key);
    } else if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-')) {
      result.date.push(key);
    } else {
      result.categorical.push(key);
    }
  }

  return result;
}

/**
 * Validate data against chart type requirements
 */
function validateDataForChartType(
  data: Array<Record<string, any>>,
  chartType: ChartType,
  variant?: ChartVariant
): ValidationResult {
  const cols = analyzeColumns(data);

  switch (chartType) {
    case 'bar':
    case 'column':
      if (cols.numeric.length === 0) {
        return {
          valid: false,
          error: `❌ Cannot create ${chartType} chart: No numeric columns found.\nFound: ${cols.categorical.length} categorical columns (${cols.categorical.join(', ')}).\nHint: Data must contain at least one numeric column for visualization.`
        };
      }
      if ((variant === 'stacked' || variant === 'grouped') && cols.numeric.length < 2) {
        return {
          valid: false,
          error: `❌ Cannot create ${variant} ${chartType}: Requires 2+ numeric columns.\nFound: ${cols.numeric.length} numeric column (${cols.numeric.join(', ')}).\nHint: Add more numeric columns, or use 'basic' variant.`
        };
      }
      if (variant === 'split' && cols.numeric.length !== 2) {
        return {
          valid: false,
          error: `❌ Cannot create split ${chartType}: Requires exactly 2 numeric columns.\nFound: ${cols.numeric.length} numeric columns (${cols.numeric.join(', ')}).\nHint: Data should have one column per side of the split.`
        };
      }
      break;

    case 'line':
    case 'area':
      if (cols.numeric.length === 0) {
        return {
          valid: false,
          error: `❌ Cannot create ${chartType} chart: No numeric columns found.\nFound: ${cols.categorical.length} categorical columns.\nHint: Data must contain at least one numeric column.`
        };
      }
      break;

    case 'scatter':
      if (cols.numeric.length < 2) {
        return {
          valid: false,
          error: `❌ Cannot create scatter plot: Requires at least 2 numeric columns.\nFound: ${cols.numeric.length} numeric column(s) (${cols.numeric.join(', ')}), ${cols.categorical.length} categorical column(s) (${cols.categorical.join(', ')}).\nHint: Need two numeric columns for x and y axes.`
        };
      }
      break;

    case 'dot':
      if (cols.numeric.length === 0) {
        return {
          valid: false,
          error: `❌ Cannot create dot plot: Requires at least 1 numeric column.\nFound: ${cols.categorical.length} categorical columns only.\nHint: Data should have [category, value] structure.`
        };
      }
      break;

    case 'range':
      if (cols.numeric.length < 2) {
        return {
          valid: false,
          error: `❌ Cannot create range plot: Requires at least 2 numeric columns for start/end values.\nFound: ${cols.numeric.length} numeric column(s).\nHint: Data should have columns like [category, start_value, end_value].`
        };
      }
      break;

    case 'arrow':
      if (cols.numeric.length < 2) {
        return {
          valid: false,
          error: `❌ Cannot create arrow plot: Requires at least 2 numeric columns for from/to values.\nFound: ${cols.numeric.length} numeric column(s).\nHint: Data should have columns like [category, from_value, to_value].`
        };
      }
      break;

    case 'pie':
    case 'donut':
    case 'election-donut':
      if (cols.numeric.length === 0) {
        return {
          valid: false,
          error: `❌ Cannot create ${chartType}: Requires 1 categorical + 1 numeric column.\nFound: ${cols.categorical.length} categorical, ${cols.numeric.length} numeric.\nHint: Data should have [label, value] structure.`
        };
      }
      if (cols.categorical.length === 0) {
        return {
          valid: false,
          error: `❌ Cannot create ${chartType}: Requires 1 categorical column for labels.\nFound: ${cols.numeric.length} numeric columns only.\nHint: Add a column with category/label names.`
        };
      }
      break;

    case 'table':
      // Tables accept any data structure
      break;
  }

  return { valid: true };
}
```

**Commit after completing this step.**

---

### Step 4: Update inferChartConfig Method

**File**: `src/chart-builder.ts`

**Update the main method to handle all chart types**:

```typescript
inferChartConfig(chartData: ChartData): ChartConfig {
  const { data, chart_type, variant, title, description, source_dataset_id } = chartData;

  // Validate data (skip for maps - handled separately)
  if (chart_type !== 'map') {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('❌ Cannot create visualization: Data array is empty.\nPlease provide at least one row of data.');
    }

    if (Array.isArray(data) && data.length > 10000) {
      throw new Error(`❌ Data exceeds Datawrapper limit of 10,000 rows (provided: ${data.length}).\nPlease filter or aggregate the data before visualization.`);
    }

    const validation = validateDataForChartType(data as Array<Record<string, any>>, chart_type, variant);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Get Datawrapper type
  const dwType = chart_type === 'map'
    ? chartData.map_type
    : getDatawrapperType(chart_type, variant);

  // Generate title
  const chartTitle = title || this.generateTitle(data, chart_type, source_dataset_id);

  // Build config based on chart type
  return this.buildChartConfig(chart_type, variant, dwType, data, chartTitle, description);
}

private buildChartConfig(
  chartType: ChartType,
  variant: ChartVariant | undefined,
  dwType: string,
  data: any,
  title: string,
  description?: string
): ChartConfig {
  const baseConfig: ChartConfig = {
    type: dwType,
    title,
    metadata: {
      describe: {
        byline: description,
      },
    },
  };

  // Add type-specific metadata
  switch (chartType) {
    case 'bar':
    case 'column':
    case 'line':
    case 'area':
      return this.addAxisConfig(baseConfig, data as Array<Record<string, any>>);

    case 'scatter':
      return this.addScatterConfig(baseConfig, data as Array<Record<string, any>>);

    case 'dot':
    case 'range':
    case 'arrow':
      return this.addAxisConfig(baseConfig, data as Array<Record<string, any>>);

    case 'pie':
    case 'donut':
    case 'election-donut':
      // Pie charts don't need axis config
      return baseConfig;

    case 'table':
      // Tables don't need visualization config
      return baseConfig;

    case 'map':
      return this.buildMapConfig(data, title, description);

    default:
      return baseConfig;
  }
}

private addAxisConfig(config: ChartConfig, data: Array<Record<string, any>>): ChartConfig {
  const cols = analyzeColumns(data);
  const xCol = cols.categorical[0] || cols.date[0] || Object.keys(data[0])[0];
  const yCol = cols.numeric[0];

  return {
    ...config,
    metadata: {
      ...config.metadata,
      visualize: {
        'x-axis-label': formatLabel(xCol),
        'y-axis-label': yCol ? formatLabel(yCol) : 'Value',
      },
    },
  };
}

private addScatterConfig(config: ChartConfig, data: Array<Record<string, any>>): ChartConfig {
  const cols = analyzeColumns(data);
  const xCol = cols.numeric[0];
  const yCol = cols.numeric[1];

  return {
    ...config,
    metadata: {
      ...config.metadata,
      visualize: {
        'x-axis-label': formatLabel(xCol),
        'y-axis-label': formatLabel(yCol),
      },
    },
  };
}
```

**Commit after completing this step.**

---

### Step 5: Update MCP Tool Schema

**File**: `src/index.ts`

**Update the tool definition**:

```typescript
{
  name: 'create_visualization',
  description: `Create a data visualization using Datawrapper API.

Supported chart types:
- bar: Horizontal bars (variants: basic, stacked, split)
- column: Vertical columns (variants: basic, grouped, stacked)
- line: Line chart
- area: Area chart
- scatter: Scatter plot (requires 2+ numeric columns)
- dot: Dot plot
- range: Range plot (requires 2 numeric columns for start/end)
- arrow: Arrow plot (requires 2 numeric columns for from/to)
- pie: Pie chart
- donut: Donut chart
- election-donut: Election donut chart
- table: Data table
- map: GeoJSON map (requires map_type parameter)`,
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        type: ['array', 'object'],
        description: 'Array of data objects to visualize. For maps, provide GeoJSON FeatureCollection.',
      },
      chart_type: {
        type: 'string',
        enum: ['bar', 'column', 'line', 'area', 'scatter', 'dot', 'range', 'arrow', 'pie', 'donut', 'election-donut', 'table', 'map'],
        description: 'Type of visualization',
      },
      variant: {
        type: 'string',
        enum: ['basic', 'stacked', 'grouped', 'split'],
        description: 'Chart variant. For bar: basic/stacked/split. For column: basic/grouped/stacked.',
      },
      map_type: {
        type: 'string',
        enum: ['d3-maps-symbols', 'd3-maps-choropleth'],
        description: 'Required when chart_type is "map"',
      },
      title: {
        type: 'string',
        description: 'Optional: Chart title (auto-generated if not provided)',
      },
      description: {
        type: 'string',
        description: 'Optional: Chart description or byline',
      },
      source_dataset_id: {
        type: 'string',
        description: 'Optional: Berlin dataset ID for tracking provenance',
      },
    },
    required: ['data', 'chart_type'],
  },
}
```

**Update handleCreateVisualization to pass variant**:

```typescript
private async handleCreateVisualization(args: any) {
  try {
    const chartData: ChartData = {
      data: args.data,
      chart_type: args.chart_type,
      variant: args.variant,
      map_type: args.map_type,
      title: args.title,
      description: args.description,
      source_dataset_id: args.source_dataset_id,
    };

    // ... rest of implementation
  }
}
```

**Commit after completing this step.**

---

### Step 6: Update Chart Logger

**File**: `src/chart-logger.ts`

**Update to log variant**:

```typescript
const logEntry: ChartLogEntry = {
  chartId: chart.id,
  url: published.url,
  embedCode,
  editUrl: `https://app.datawrapper.de/chart/${chart.id}/visualize`,
  chartType: dwType,  // Now stores the Datawrapper type string
  variant: chartData.variant,
  title: config.title,
  createdAt: new Date().toISOString(),
  sourceDatasetId: chartData.source_dataset_id,
  dataRowCount: Array.isArray(chartData.data)
    ? chartData.data.length
    : chartData.data.features?.length || 0,
};
```

**Commit after completing this step.**

---

### Step 7: Test Each Chart Type

**Manual testing checklist**:

Test each chart type with sample data to verify it works correctly:

- [ ] `bar` + `basic` - Simple bar chart
- [ ] `bar` + `stacked` - Stacked bar chart
- [ ] `bar` + `split` - Split bar chart (population pyramid style)
- [ ] `column` + `basic` - Simple column chart
- [ ] `column` + `grouped` - Grouped column chart
- [ ] `column` + `stacked` - Stacked column chart
- [ ] `line` - Line chart
- [ ] `area` - Area chart
- [ ] `scatter` - Scatter plot
- [ ] `dot` - Dot plot
- [ ] `range` - Range plot
- [ ] `arrow` - Arrow plot
- [ ] `pie` - Pie chart
- [ ] `donut` - Donut chart
- [ ] `election-donut` - Election donut
- [ ] `table` - Data table
- [ ] `map` + `d3-maps-symbols` - Symbol map
- [ ] `map` + `d3-maps-choropleth` - Choropleth map

**Test validation errors**:

- [ ] Scatter plot with only 1 numeric column → clear error
- [ ] Stacked bar with only 1 numeric column → clear error
- [ ] Pie chart with no categorical column → clear error
- [ ] Empty data → clear error

**Commit test results documentation.**

---

### Step 8: Update Documentation

**Files to update**:
- `README.md` - Add new chart types to examples

**Commit after completing this step.**

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add ChartType, ChartVariant types; update interfaces |
| `src/chart-builder.ts` | Add type mapping, validation, config builders |
| `src/index.ts` | Update tool schema, pass variant to handler |
| `src/chart-logger.ts` | Log variant field |
| `README.md` | Update examples |

---

## Testing Commands

```bash
# Build
npm run build

# Test with MCP inspector
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_visualization","arguments":{"data":[{"category":"A","value":10},{"category":"B","value":20}],"chart_type":"bar"}}}' | node dist/index.js

# Test stacked bar
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_visualization","arguments":{"data":[{"category":"A","val1":10,"val2":5},{"category":"B","val1":20,"val2":8}],"chart_type":"bar","variant":"stacked"}}}' | node dist/index.js

# Test scatter
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_visualization","arguments":{"data":[{"x":1,"y":2},{"x":3,"y":4}],"chart_type":"scatter"}}}' | node dist/index.js

# Test validation error
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_visualization","arguments":{"data":[{"name":"A"},{"name":"B"}],"chart_type":"scatter"}}}' | node dist/index.js
```

---

*Last Updated: December 2025*
