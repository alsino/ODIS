// ABOUTME: Test script to find scatter plot label settings
// ABOUTME: Run with: npm run build && node dist/tests/test-scatter-labels.js

import * as dotenv from 'dotenv';
import axios from 'axios';
import { ChartBuilder } from '../chart-builder.js';

dotenv.config();

const API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;
if (!API_TOKEN) {
  console.error('DATAWRAPPER_API_TOKEN required');
  process.exit(1);
}

const builder = new ChartBuilder();

const api = axios.create({
  baseURL: 'https://api.datawrapper.de/v3',
  headers: { Authorization: `Bearer ${API_TOKEN}` },
});

const scatterData = [
  { Bezirk: 'Mitte', x: 6.2, y: 13521 },
  { Bezirk: 'Pankow', x: 15.3, y: 4089 },
  { Bezirk: 'Neukölln', x: 5.4, y: 7284 },
  { Bezirk: 'Spandau', x: 22.7, y: 2665 },
];

async function main() {
  console.log('Creating scatter plot and testing label settings...\n');

  // Create chart
  const createRes = await api.post('/charts', { type: 'd3-scatter-plot' });
  const chartId = createRes.data.id;
  console.log(`Chart ID: ${chartId}`);

  // Upload data
  const dataString = builder.formatForDatawrapper(scatterData);
  await api.put(`/charts/${chartId}/data`, dataString, {
    headers: { 'Content-Type': 'text/csv' },
  });

  // Try setting label settings - labels go in axes, not visualize
  await api.patch(`/charts/${chartId}`, {
    title: 'Scatter with labels',
    metadata: {
      describe: {
        'source-name': 'Berlin Open Data',
        'source-url': 'https://daten.berlin.de',
      },
      axes: {
        x: 'x',
        y: 'y',
        labels: 'Bezirk',
      },
    },
  });

  // Get metadata to see what was accepted
  const getRes = await api.get(`/charts/${chartId}`);
  console.log('\nAxes metadata:');
  console.log(JSON.stringify(getRes.data.metadata.axes, null, 2));
  console.log('\nVisualize metadata:');
  console.log(JSON.stringify(getRes.data.metadata.visualize, null, 2));
  console.log('\nDescribe metadata:');
  console.log(JSON.stringify(getRes.data.metadata.describe, null, 2));

  // Publish
  const pubRes = await api.post(`/charts/${chartId}/publish`);
  const publicId = pubRes.data.publicId || chartId;

  console.log(`\n✅ Chart URL: https://datawrapper.dwcdn.net/${publicId}/`);
  console.log(`   Edit URL: https://app.datawrapper.de/chart/${chartId}/visualize`);
  console.log('\nPlease check the Edit URL and enable labels in the UI, then tell me the settings.');
}

main().catch(console.error);
