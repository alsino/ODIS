# Extended Chart Types - Implementation Plan

## Overview

This document provides a step-by-step implementation guide for extending the Datawrapper MCP server with additional chart types. The MVP (bar, line, map) is already implemented; this plan covers adding the remaining chart types.

---

## Current State

### ✅ Completed

- **Step 1**: Type definitions updated (`src/types.ts`)
  - ChartType with all 13 types
  - ChartVariant type
  - ValidationResult, ColumnAnalysis interfaces

- **Step 2**: Datawrapper type mapping (`src/chart-builder.ts`)
  - DATAWRAPPER_TYPE_MAP constant
  - getDatawrapperType() method

- **Step 3**: Data validation (`src/chart-builder.ts`)
  - analyzeColumns() method
  - validateDataForChartType() method with clear error messages

- **Step 4**: MCP tool schema updated (`src/index.ts`)
  - chart_type enum expanded to all 13 types
  - variant parameter added
  - handleCreateVisualization uses new validation

- **Step 5**: Live API testing completed
  - All 16 chart type/variant combinations tested
  - Test script: `src/tests/test-chart-types.ts`

### ✅ Additional Discoveries from Testing

**Visualize settings needed for proper display:**

| Chart Type | Required Settings |
|------------|-------------------|
| Range plot | `show-value-labels: true`, `range-value-labels: 'both'`, `label-first-range: true` |
| Arrow plot | `show-value-labels: true`, `range-value-labels: 'both'`, `label-first-range: true` |
| Dot plot | Above + `show-color-key: true` for legend |
| Election donut | `custom-colors: { [party]: '#hexcolor' }` for party colors |

**Data column naming matters:**
- Range/arrow plots: Column headers become end labels (e.g., "Women", "Men" instead of "min", "max")
- Dot plots: Column headers become legend labels (e.g., "2023", "2024")

---

## Remaining Steps

### Step 6: Integrate Visualize Settings into Main Code

**Status**: 🔲 Not started

The test script has the correct visualize settings, but the main `index.ts` handler doesn't apply them automatically. Need to:

1. Add default visualize settings for range/arrow/dot plots in `handleCreateVisualization`
2. Consider whether election donut should auto-detect party names and apply common party colors

**File**: `src/index.ts`

**Changes needed**:

```typescript
// Add after getting dwChartType
const visualizeSettings = getDefaultVisualizeSettings(chart_type, variant);

// Merge with existing metadata
const metadata: any = {
  visualize: {
    'base-color': '#2A7FFF',
    ...visualizeSettings,  // Add type-specific settings
  },
  // ... rest
};
```

**Helper function to add**:

```typescript
function getDefaultVisualizeSettings(chartType: ChartType, variant?: ChartVariant): Record<string, any> {
  switch (chartType) {
    case 'range':
    case 'arrow':
      return {
        'show-value-labels': true,
        'range-value-labels': 'both',
        'label-first-range': true,
      };
    case 'dot':
      return {
        'show-value-labels': true,
        'range-value-labels': 'both',
        'label-first-range': true,
        'show-color-key': true,
      };
    default:
      return {};
  }
}
```

---

### Step 7: Update Documentation

**Status**: 🔲 Not started

**Files to update**:
- `README.md` - Add new chart types to examples
- `docs/plans/design-spec.md` - Mark as implemented

---

## Summary of Completed Work

| Step | File | Status |
|------|------|--------|
| Types | `src/types.ts` | ✅ Done |
| Type mapping | `src/chart-builder.ts` | ✅ Done |
| Validation | `src/chart-builder.ts` | ✅ Done |
| MCP schema | `src/index.ts` | ✅ Done |
| Unit tests | `src/tests/chart-builder.test.ts` | ✅ 36 tests |
| Integration tests | `src/tests/index.test.ts` | ✅ 24 tests |
| API tests | `src/tests/test-chart-types.ts` | ✅ 16/16 pass |
| Visualize settings | `src/index.ts` | 🔲 Pending |
| Documentation | `README.md` | 🔲 Pending |

---

## Verified Chart Types

All chart types have been tested with the live Datawrapper API:

| Chart Type | Variant | Datawrapper Type | Status |
|------------|---------|------------------|--------|
| bar | basic | d3-bars | ✅ |
| bar | stacked | d3-bars-stacked | ✅ |
| bar | split | d3-bars-split | ✅ |
| column | basic | column-chart | ✅ |
| column | grouped | grouped-column-chart | ✅ |
| column | stacked | stacked-column-chart | ✅ |
| line | basic | d3-lines | ✅ |
| area | basic | d3-area | ✅ |
| scatter | basic | d3-scatter-plot | ✅ |
| dot | basic | d3-dot-plot | ✅ |
| range | basic | d3-range-plot | ✅ |
| arrow | basic | d3-arrow-plot | ✅ |
| pie | basic | d3-pies | ✅ |
| donut | basic | d3-donuts | ✅ |
| election-donut | basic | election-donut-chart | ✅ |
| table | basic | tables | ✅ |

---

## Testing Commands

```bash
# Run unit tests
npm test

# Run live API tests (creates actual charts)
npm run build && node dist/tests/test-chart-types.js
```

---

*Last Updated: December 2025*
