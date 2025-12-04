// ABOUTME: Test script for map creation with Berlin data
// ABOUTME: Validates bounding box calculation and map view settings

import { ChartBuilder } from '../chart-builder.js';
import { DatawrapperClient } from '../datawrapper-client.js';
import { GeoJSON } from '../types.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATAWRAPPER_API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;

if (!DATAWRAPPER_API_TOKEN) {
  console.error('Error: DATAWRAPPER_API_TOKEN not found in environment');
  process.exit(1);
}

// Sample Berlin Christmas markets GeoJSON (subset)
const berlinMarketsGeoJSON: GeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [13.386, 52.477]
      },
      properties: {
        name: 'Winter am THF'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [13.377, 52.516]
      },
      properties: {
        name: 'Weihnachtsmarkt Charlottenburg'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [13.405, 52.520]
      },
      properties: {
        name: 'Gendarmenmarkt'
      }
    }
  ]
};

async function testMapCreation() {
  console.log('🧪 Testing Map Creation with Berlin Data\n');

  const chartBuilder = new ChartBuilder();
  const datawrapperClient = new DatawrapperClient(DATAWRAPPER_API_TOKEN!);

  try {
    // Step 1: Test bounding box calculation
    console.log('Step 1: Testing bounding box calculation...');
    const config = chartBuilder.inferChartConfig(berlinMarketsGeoJSON, 'map', 'Test Berlin Christmas Markets');

    if (!config.bbox) {
      throw new Error('Bounding box not calculated!');
    }

    console.log('✅ Bounding box calculated:');
    console.log(`   Longitude: ${config.bbox.minLon.toFixed(3)} to ${config.bbox.maxLon.toFixed(3)}`);
    console.log(`   Latitude: ${config.bbox.minLat.toFixed(3)} to ${config.bbox.maxLat.toFixed(3)}`);
    console.log(`   Selected basemap: ${config.basemap}`);

    // Verify it's in Berlin range (roughly)
    const isBerlin = config.bbox.minLon > 13.0 && config.bbox.maxLon < 14.0 &&
                     config.bbox.minLat > 52.0 && config.bbox.maxLat < 53.0;

    if (!isBerlin) {
      throw new Error('Bounding box not in Berlin range!');
    }
    console.log('✅ Bounding box is in Berlin range\n');

    // Step 2: Create chart with metadata
    console.log('Step 2: Creating chart...');
    const metadata: any = {
      visualize: {
        'base-color': '#2A7FFF',
        basemap: config.basemap
      },
      title: config.title
    };

    const chart = await datawrapperClient.createChart('d3-maps-symbols', metadata);
    console.log(`✅ Chart created: ${chart.id}\n`);

    // Step 3: Upload data
    console.log('Step 3: Converting GeoJSON to CSV and uploading...');
    const strippedGeoJSON = chartBuilder.stripGeoJSONProperties(berlinMarketsGeoJSON, 'd3-maps-symbols');
    const dataString = chartBuilder.processGeoJSON(strippedGeoJSON, 'd3-maps-symbols');
    console.log('CSV data:');
    console.log(dataString);
    await datawrapperClient.uploadData(chart.id, dataString);
    console.log('✅ Data uploaded\n');

    // Step 4: Publish chart
    console.log('Step 4: Publishing chart...');
    const publishedChart = await datawrapperClient.publishChart(chart.id);
    const publicId = publishedChart.publicId || chart.id;
    const publicUrl = datawrapperClient.getPublicUrl(publicId);
    const editUrl = datawrapperClient.getEditUrl(chart.id);

    console.log('✅ Chart published!\n');
    console.log('📍 Results:');
    console.log(`   Public URL: ${publicUrl}`);
    console.log(`   Edit URL: ${editUrl}`);
    console.log(`   Map type: d3-maps-symbols`);
    console.log(`   Features: ${berlinMarketsGeoJSON.features.length}`);
    console.log('\n✨ Test completed successfully!\n');
    console.log('👉 Please open the Public URL to verify the map shows Berlin (not world view)');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testMapCreation();
