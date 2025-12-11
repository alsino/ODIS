// ABOUTME: Quick script to inspect chart metadata
// ABOUTME: Run with: npm run build && node dist/tests/inspect-chart.js <chartId>

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;
if (!API_TOKEN) {
  console.error('DATAWRAPPER_API_TOKEN required');
  process.exit(1);
}

const chartId = process.argv[2];
if (!chartId) {
  console.error('Usage: node dist/tests/inspect-chart.js <chartId>');
  process.exit(1);
}

const api = axios.create({
  baseURL: 'https://api.datawrapper.de/v3',
  headers: { Authorization: `Bearer ${API_TOKEN}` },
});

async function main() {
  const res = await api.get(`/charts/${chartId}`);
  console.log('=== AXES METADATA ===');
  console.log(JSON.stringify(res.data.metadata.axes, null, 2));
  console.log('\n=== VISUALIZE METADATA ===');
  console.log(JSON.stringify(res.data.metadata.visualize, null, 2));
  console.log('\n=== DESCRIBE METADATA ===');
  console.log(JSON.stringify(res.data.metadata.describe, null, 2));
}

main().catch(console.error);
