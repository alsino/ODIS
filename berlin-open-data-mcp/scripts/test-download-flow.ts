// ABOUTME: Test complete download flow to verify GeoJSON vs tabular format
// ABOUTME: Simulates the download_dataset tool behavior with WFS data

import { DataFetcher } from '../src/data-fetcher.js';
import * as fs from 'fs';

async function testDownloadFlow() {
  console.log('=== Testing Complete Download Flow ===\n');

  const fetcher = new DataFetcher();
  const url = 'https://gdi.berlin.de/services/wfs/alkis_ortsteile';

  // Simulate fetching data (like download_dataset does)
  const fetchedData = await fetcher.fetchResource(url, 'WFS');

  if (fetchedData.error) {
    console.log('❌ Error:', fetchedData.error);
    return;
  }

  console.log('✓ Data fetched successfully');
  console.log(`  Tabular rows: ${fetchedData.rows.length}`);
  console.log(`  Original GeoJSON: ${fetchedData.originalGeoJSON ? 'preserved' : 'MISSING'}`);

  // Test JSON output (like download_dataset with format='json')
  console.log('\n=== Testing JSON Download Format ===\n');

  const outputFormat = 'json';
  let fileContent: string;
  let mimeType: string;
  let fileExtension: string;

  // THIS IS THE KEY LOGIC FROM index.ts
  if (outputFormat === 'json' && fetchedData.originalGeoJSON) {
    fileContent = JSON.stringify(fetchedData.originalGeoJSON, null, 2);
    mimeType = 'application/geo+json';
    fileExtension = 'geojson';
    console.log('✓ Using originalGeoJSON for download');
  } else {
    // Fallback to tabular format
    fileContent = JSON.stringify(fetchedData.rows, null, 2);
    mimeType = 'application/json';
    fileExtension = 'json';
    console.log('✗ Fallback to tabular format (NOT GEOJSON)');
  }

  console.log(`  MIME type: ${mimeType}`);
  console.log(`  Extension: ${fileExtension}`);
  console.log(`  Size: ${(fileContent.length / 1024).toFixed(2)} KB`);

  // Validate the output
  const parsed = JSON.parse(fileContent);

  console.log('\n=== Validating Download Content ===\n');

  if (parsed.type === 'FeatureCollection') {
    console.log('✓✓✓ SUCCESS: Downloaded file is valid GeoJSON!');
    console.log(`  Type: ${parsed.type}`);
    console.log(`  Features: ${parsed.features.length}`);

    // Check first feature structure
    if (parsed.features.length > 0) {
      const f = parsed.features[0];
      console.log(`  First feature has:`);
      console.log(`    - type: ${f.type}`);
      console.log(`    - geometry.type: ${f.geometry?.type}`);
      console.log(`    - geometry.coordinates: ${f.geometry?.coordinates ? 'present' : 'MISSING'}`);
      console.log(`    - properties: ${Object.keys(f.properties || {}).length} attributes`);

      // Verify coordinates are NOT stringified
      if (typeof f.geometry?.coordinates === 'string') {
        console.log('\n❌ FAIL: Coordinates are stringified!');
        return;
      }
      console.log('    ✓ Coordinates are proper arrays (not strings)');
    }
  } else if (Array.isArray(parsed)) {
    console.log('❌ FAIL: Downloaded file is tabular format, not GeoJSON');
    console.log(`  It's an array with ${parsed.length} items`);
    if (parsed.length > 0) {
      console.log(`  First item keys: ${Object.keys(parsed[0]).join(', ')}`);
      if (parsed[0].geometry_coordinates) {
        console.log('  ❌ Has "geometry_coordinates" (stringified geometry)');
      }
    }
    return;
  } else {
    console.log('❌ FAIL: Unknown format');
    return;
  }

  // Write to file for manual inspection
  const outputPath = '/tmp/test-download.geojson';
  fs.writeFileSync(outputPath, fileContent);
  console.log(`\n✓ Sample written to: ${outputPath}`);

  console.log('\n=== ✅ DOWNLOAD FLOW TEST PASSED ===\n');
}

testDownloadFlow().catch(console.error);
