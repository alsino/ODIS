// ABOUTME: Manual test script for all chart types via Datawrapper API
// ABOUTME: Run with: npm run build && node dist/tests/test-chart-types.js

import * as dotenv from 'dotenv';
import { DatawrapperClient } from '../datawrapper-client.js';
import { ChartBuilder } from '../chart-builder.js';

dotenv.config();

const API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;
if (!API_TOKEN) {
  console.error('DATAWRAPPER_API_TOKEN required');
  process.exit(1);
}

const client = new DatawrapperClient(API_TOKEN);
const builder = new ChartBuilder();

interface TestCase {
  name: string;
  chartType: string;
  variant?: string;
  data: Array<Record<string, any>>;
  visualize?: Record<string, any>;
}

// Label settings for range/arrow/dot plots
const RANGE_ARROW_LABELS = {
  'show-value-labels': true,
  'range-value-labels': 'both',
  'label-first-range': true,
};

const DOT_PLOT_LABELS = {
  'show-value-labels': true,
  'range-value-labels': 'both',
  'label-first-range': true,
  'show-color-key': true,
};

// German party colors for election donut
const ELECTION_DONUT_COLORS = {
  'custom-colors': {
    'SPD': '#E3000F',
    'CDU/CSU': '#000000',
    'Grüne': '#1AA037',
    'FDP': '#FFED00',
    'AfD': '#009EE0',
    'Linke': '#BE3075',
  },
};

// Sample data for different chart requirements
const categoryNumericData = [
  { category: 'Berlin', Sales: 120 },
  { category: 'Munich', Sales: 95 },
  { category: 'Hamburg', Sales: 110 },
  { category: 'Cologne', Sales: 75 },
];

// Dot plots work best with multiple numeric columns to compare
const dotPlotData = [
  { category: 'Berlin', '2023': 85, '2024': 92 },
  { category: 'Munich', '2023': 78, '2024': 88 },
  { category: 'Hamburg', '2023': 82, '2024': 79 },
  { category: 'Cologne', '2023': 71, '2024': 84 },
];

const categoryMultiNumericData = [
  { category: 'Berlin', online: 45, offline: 30 },
  { category: 'Munich', online: 35, offline: 40 },
  { category: 'Hamburg', online: 50, offline: 25 },
];

const categorySplitData = [
  { category: 'Berlin', left: 45, right: 30 },
  { category: 'Munich', left: 35, right: 40 },
  { category: 'Hamburg', left: 50, right: 25 },
];

const timeSeriesData = [
  { date: '2024-01', value: 100 },
  { date: '2024-02', value: 120 },
  { date: '2024-03', value: 115 },
  { date: '2024-04', value: 140 },
  { date: '2024-05', value: 135 },
];

const scatterData = [
  { city: 'Berlin', population: 3.6, area: 891 },
  { city: 'Munich', population: 1.5, area: 310 },
  { city: 'Hamburg', population: 1.9, area: 755 },
  { city: 'Cologne', population: 1.1, area: 405 },
];

const rangeData = [
  { category: 'Berlin', Women: 52000, Men: 61000 },
  { category: 'Munich', Women: 48000, Men: 58000 },
  { category: 'Hamburg', Women: 50000, Men: 62000 },
];

const pieData = [
  { party: 'SPD', votes: 25.7 },
  { party: 'CDU', votes: 24.1 },
  { party: 'Grüne', votes: 14.8 },
  { party: 'FDP', votes: 11.5 },
  { party: 'AfD', votes: 10.3 },
];

const electionData = [
  { party: 'SPD', seats: 206 },
  { party: 'CDU/CSU', seats: 196 },
  { party: 'Grüne', seats: 118 },
  { party: 'FDP', seats: 92 },
  { party: 'AfD', seats: 83 },
  { party: 'Linke', seats: 39 },
];

const tableData = [
  { city: 'Berlin', population: '3.6M', founded: 1237 },
  { city: 'Munich', population: '1.5M', founded: 1158 },
  { city: 'Hamburg', population: '1.9M', founded: 808 },
];

// All test cases covering every chart type and variant
const testCases: TestCase[] = [
  // Bar variants
  {
    name: 'Bar (basic)',
    chartType: 'bar',
    variant: 'basic',
    data: categoryNumericData,
  },
  {
    name: 'Bar (stacked)',
    chartType: 'bar',
    variant: 'stacked',
    data: categoryMultiNumericData,
  },
  {
    name: 'Bar (split)',
    chartType: 'bar',
    variant: 'split',
    data: categorySplitData,
  },

  // Column variants
  {
    name: 'Column (basic)',
    chartType: 'column',
    variant: 'basic',
    data: categoryNumericData,
  },
  {
    name: 'Column (grouped)',
    chartType: 'column',
    variant: 'grouped',
    data: categoryMultiNumericData,
  },
  {
    name: 'Column (stacked)',
    chartType: 'column',
    variant: 'stacked',
    data: categoryMultiNumericData,
  },

  // Line and area
  {
    name: 'Line',
    chartType: 'line',
    data: timeSeriesData,
  },
  {
    name: 'Area',
    chartType: 'area',
    data: timeSeriesData,
  },

  // Dot plots
  {
    name: 'Scatter',
    chartType: 'scatter',
    data: scatterData,
  },
  {
    name: 'Dot plot',
    chartType: 'dot',
    data: dotPlotData,
    visualize: DOT_PLOT_LABELS,
  },

  // Range and arrow
  {
    name: 'Range plot',
    chartType: 'range',
    data: rangeData,
    visualize: RANGE_ARROW_LABELS,
  },
  {
    name: 'Arrow plot',
    chartType: 'arrow',
    data: rangeData,
    visualize: RANGE_ARROW_LABELS,
  },

  // Pie/donut family
  {
    name: 'Pie',
    chartType: 'pie',
    data: pieData,
  },
  {
    name: 'Donut',
    chartType: 'donut',
    data: pieData,
  },
  {
    name: 'Election donut',
    chartType: 'election-donut',
    data: electionData,
    visualize: ELECTION_DONUT_COLORS,
  },

  // Table
  {
    name: 'Table',
    chartType: 'table',
    data: tableData,
  },
];

async function runTest(test: TestCase): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validate data
    const validation = builder.validateDataForChartType(
      test.data,
      test.chartType as any,
      test.variant as any
    );
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.error}` };
    }

    // Get Datawrapper type
    const dwType = builder.getDatawrapperType(test.chartType as any, test.variant as any);

    // Create chart with optional visualize settings
    const metadata: Record<string, any> = {
      title: `Test: ${test.name}`,
    };
    if (test.visualize) {
      metadata.visualize = test.visualize;
    }

    const chart = await client.createChart(dwType, metadata);

    // Upload data
    const dataString = builder.formatForDatawrapper(test.data);
    await client.uploadData(chart.id, dataString);

    // Publish
    const published = await client.publishChart(chart.id);
    const url = client.getPublicUrl(published.publicId || chart.id);

    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Testing ALL chart types with Datawrapper API\n');
  console.log('='.repeat(60));

  const results: Array<{ name: string; success: boolean; url?: string; error?: string }> = [];

  for (const test of testCases) {
    console.log(`\nTesting: ${test.name}...`);
    const result = await runTest(test);
    results.push({ name: test.name, ...result });

    if (result.success) {
      console.log(`  ✅ Success: ${result.url}`);
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\nSummary:');
  const passed = results.filter((r) => r.success).length;
  console.log(`  ${passed}/${results.length} tests passed`);

  if (passed < results.length) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
  }

  // Print all URLs for easy access
  console.log('\nAll chart URLs:');
  results
    .filter((r) => r.success)
    .forEach((r) => console.log(`  ${r.name}: ${r.url}`));
}

main().catch(console.error);
