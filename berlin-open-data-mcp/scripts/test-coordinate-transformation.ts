// ABOUTME: Test coordinate transformation from EPSG:25833 to WGS84
// ABOUTME: Verify transformed coordinates are valid for web maps

import { DataFetcher } from '../src/data-fetcher.js';
import { GeoJSONTransformer } from '../src/geojson-transformer.js';
import * as fs from 'fs';

async function testTransformation() {
  console.log('=== Testing Coordinate Transformation ===\n');

  const fetcher = new DataFetcher();
  const transformer = new GeoJSONTransformer();

  // Fetch ALKIS Ortsteile (known to be in EPSG:25833)
  const url = 'https://gdi.berlin.de/services/wfs/alkis_ortsteile';
  console.log(`Fetching: ${url}\n`);

  const fetchedData = await fetcher.fetchResource(url, 'WFS');

  if (fetchedData.error || !fetchedData.originalGeoJSON) {
    console.log('❌ Error:', fetchedData.error || 'No GeoJSON');
    return;
  }

  const originalGeoJSON = fetchedData.originalGeoJSON;

  console.log('✓ Original GeoJSON fetched');
  console.log(`  Features: ${originalGeoJSON.features.length}`);

  // Get sample coordinates BEFORE transformation
  const firstFeature = originalGeoJSON.features[0];
  const originalCoords = firstFeature.geometry.coordinates[0][0][0]; // First point of first ring
  console.log(`\n=== BEFORE Transformation (EPSG:25833) ===`);
  console.log(`  First coordinate: [${originalCoords[0]}, ${originalCoords[1]}]`);
  console.log(`  → These are UTM coordinates (meters from zone origin)`);

  // Check if CRS is specified
  if (originalGeoJSON.crs) {
    console.log(`  CRS in GeoJSON: ${JSON.stringify(originalGeoJSON.crs.properties.name)}`);
  }

  // Transform to WGS84
  console.log(`\n=== Transforming... ===`);
  const transformedGeoJSON = transformer.transformToWGS84(originalGeoJSON);

  // Get sample coordinates AFTER transformation
  const transformedFeature = transformedGeoJSON.features[0];
  const transformedCoords = transformedFeature.geometry.coordinates[0][0][0];

  console.log(`\n=== AFTER Transformation (WGS84 / EPSG:4326) ===`);
  console.log(`  First coordinate: [${transformedCoords[0].toFixed(6)}, ${transformedCoords[1].toFixed(6)}]`);
  console.log(`  → Longitude: ${transformedCoords[0].toFixed(6)}° (should be ~13° for Berlin)`);
  console.log(`  → Latitude: ${transformedCoords[1].toFixed(6)}° (should be ~52° for Berlin)`);

  // Validate WGS84 coordinate ranges
  console.log(`\n=== Validation ===`);

  let valid = true;

  // Berlin is approximately at lon: 13.4, lat: 52.5
  // Valid range for Berlin: lon: 13.0-13.8, lat: 52.3-52.7
  if (transformedCoords[0] < 13.0 || transformedCoords[0] > 13.8) {
    console.log(`  ❌ Longitude ${transformedCoords[0]} is out of range for Berlin (expected 13.0-13.8)`);
    valid = false;
  } else {
    console.log(`  ✓ Longitude is valid for Berlin`);
  }

  if (transformedCoords[1] < 52.3 || transformedCoords[1] > 52.7) {
    console.log(`  ❌ Latitude ${transformedCoords[1]} is out of range for Berlin (expected 52.3-52.7)`);
    valid = false;
  } else {
    console.log(`  ✓ Latitude is valid for Berlin`);
  }

  // Check that CRS property was removed (WGS84 is default per GeoJSON spec)
  if (transformedGeoJSON.crs) {
    console.log(`  ⚠️  Warning: CRS property still present (should be removed for WGS84)`);
  } else {
    console.log(`  ✓ CRS property removed (WGS84 is implicit per GeoJSON spec)`);
  }

  // Test multiple coordinates to ensure consistency
  console.log(`\n=== Testing Multiple Coordinates ===`);
  const sampleCount = Math.min(5, transformedGeoJSON.features.length);

  for (let i = 0; i < sampleCount; i++) {
    const feature = transformedGeoJSON.features[i];
    const coords = feature.geometry.coordinates[0][0][0];
    const inRange = coords[0] >= 13.0 && coords[0] <= 13.8 &&
                    coords[1] >= 52.3 && coords[1] <= 52.7;
    console.log(`  Feature ${i + 1}: [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}] ${inRange ? '✓' : '❌'}`);
    if (!inRange) valid = false;
  }

  // Write transformed GeoJSON to file
  const outputPath = '/tmp/transformed.geojson';
  fs.writeFileSync(outputPath, JSON.stringify(transformedGeoJSON, null, 2));
  console.log(`\n✓ Transformed GeoJSON written to: ${outputPath}`);

  // Final result
  console.log(`\n=== ${valid ? '✅ TRANSFORMATION SUCCESSFUL' : '❌ TRANSFORMATION FAILED'} ===`);

  if (valid) {
    console.log('\nThe transformed GeoJSON is ready for web maps!');
    console.log('You can now visualize it on:');
    console.log('  - https://geojson.io');
    console.log('  - Leaflet, Mapbox, Google Maps, etc.');
  }

  return valid;
}

testTransformation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
