// ABOUTME: Test that WFS downloads produce valid GeoJSON format
// ABOUTME: Verifies originalGeoJSON preservation and proper FeatureCollection structure

import { DataFetcher } from '../src/data-fetcher.js';

async function testGeoJSONDownload() {
  console.log('=== Testing GeoJSON Download Format ===\n');

  const fetcher = new DataFetcher();

  // Test with ALKIS Berlin Ortsteile WFS
  const url = 'https://gdi.berlin.de/services/wfs/alkis_ortsteile';
  console.log(`Fetching: ${url}\n`);

  const result = await fetcher.fetchResource(url, 'WFS');

  if (result.error) {
    console.log('❌ Error:', result.error);
    return;
  }

  console.log('✓ Fetch successful');
  console.log(`  Format: ${result.format}`);
  console.log(`  Rows (tabular): ${result.rows.length}`);
  console.log(`  Columns: ${result.columns.length}`);

  // Check if originalGeoJSON exists
  if (!result.originalGeoJSON) {
    console.log('\n❌ FAIL: originalGeoJSON not preserved!');
    return;
  }

  console.log('\n✓ originalGeoJSON preserved');

  // Validate GeoJSON structure
  const geojson = result.originalGeoJSON;

  console.log('\n=== Validating GeoJSON Structure ===\n');

  // Check type
  if (geojson.type !== 'FeatureCollection') {
    console.log(`❌ FAIL: type is "${geojson.type}", expected "FeatureCollection"`);
    return;
  }
  console.log('✓ type: "FeatureCollection"');

  // Check features array
  if (!Array.isArray(geojson.features)) {
    console.log('❌ FAIL: features is not an array');
    return;
  }
  console.log(`✓ features: Array with ${geojson.features.length} items`);

  // Validate first feature
  if (geojson.features.length > 0) {
    const firstFeature = geojson.features[0];

    console.log('\n=== Validating First Feature ===\n');

    if (firstFeature.type !== 'Feature') {
      console.log(`❌ FAIL: feature type is "${firstFeature.type}", expected "Feature"`);
      return;
    }
    console.log('✓ type: "Feature"');

    if (!firstFeature.geometry || typeof firstFeature.geometry !== 'object') {
      console.log('❌ FAIL: geometry is missing or invalid');
      return;
    }
    console.log(`✓ geometry: { type: "${firstFeature.geometry.type}" }`);

    if (!firstFeature.geometry.coordinates) {
      console.log('❌ FAIL: coordinates are missing');
      return;
    }
    console.log('✓ coordinates: present');

    if (!firstFeature.properties || typeof firstFeature.properties !== 'object') {
      console.log('❌ FAIL: properties are missing or invalid');
      return;
    }
    console.log(`✓ properties: ${Object.keys(firstFeature.properties).length} attributes`);

    // Show sample of properties
    console.log('\n  Sample properties:');
    const props = Object.keys(firstFeature.properties).slice(0, 5);
    props.forEach(key => {
      console.log(`    ${key}: ${firstFeature.properties[key]}`);
    });
  }

  // Test JSON serialization
  console.log('\n=== Testing JSON Serialization ===\n');

  try {
    const jsonString = JSON.stringify(geojson, null, 2);
    console.log(`✓ Serializes to ${(jsonString.length / 1024).toFixed(2)} KB`);

    // Verify it can be parsed back
    const parsed = JSON.parse(jsonString);
    if (parsed.type !== 'FeatureCollection') {
      console.log('❌ FAIL: parsed JSON is not valid GeoJSON');
      return;
    }
    console.log('✓ Round-trip parse successful');
  } catch (error) {
    console.log('❌ FAIL: JSON serialization error:', error);
    return;
  }

  console.log('\n=== ✅ ALL TESTS PASSED ===\n');
  console.log('The GeoJSON structure is valid and ready for download!');
}

testGeoJSONDownload().catch(console.error);
