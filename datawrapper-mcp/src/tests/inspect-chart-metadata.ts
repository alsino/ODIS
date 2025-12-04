// ABOUTME: Inspect chart metadata to understand structure
// ABOUTME: Helps identify metadata fields for map customization

import { DatawrapperClient } from '../datawrapper-client.js';
import * as dotenv from 'dotenv';

dotenv.config();

const DATAWRAPPER_API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;

if (!DATAWRAPPER_API_TOKEN) {
  console.error('Error: DATAWRAPPER_API_TOKEN not found in environment');
  process.exit(1);
}

async function inspectChart() {
  const client = new DatawrapperClient(DATAWRAPPER_API_TOKEN!);

  // Use one of our test charts
  const chartId = 'TZjyZ'; // From earlier test

  try {
    const chart = await client.getChartInfo(chartId);
    console.log('Chart Metadata:');
    console.log(JSON.stringify(chart.metadata, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

inspectChart();
