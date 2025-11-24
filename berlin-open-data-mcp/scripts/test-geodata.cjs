// Test GeoJSON and KML parsing with real Berlin Open Data Portal datasets

const { DataFetcher } = require('../dist/data-fetcher.js');
const { BerlinOpenDataAPI } = require('../dist/berlin-api.js');

async function testGeoJSON() {
  console.log('🗺️  Testing GeoJSON parsing\n');

  const api = new BerlinOpenDataAPI();
  const fetcher = new DataFetcher();

  try {
    // Search for GeoJSON datasets
    const results = await api.searchDatasets({ query: 'geojson', limit: 10 });

    console.log(`Found ${results.count} GeoJSON datasets\n`);

    if (results.results.length === 0) {
      console.log('⏭️  No GeoJSON datasets found for testing\n');
      return false;
    }

    // Try first few datasets with GeoJSON resource
    for (const result of results.results) {
      const dataset = await api.getDataset(result.name);
      // Look for GeoJSON in various formats: GeoJSON, JSON, gjson, GEOJSON-Datei
      const geoResource = dataset.resources.find(r => {
        const fmt = r.format?.toLowerCase() || '';
        const url = r.url?.toLowerCase() || '';
        return fmt.includes('geojson') || fmt === 'json' && url.includes('geojson') || fmt === 'gjson';
      });

      if (geoResource) {
        console.log(`Testing dataset: ${dataset.title}`);
        console.log(`Resource: ${geoResource.name}`);
        console.log(`URL: ${geoResource.url}`);

        const data = await fetcher.fetchResource(geoResource.url, geoResource.format);

        if (data.error) {
          console.log(`⚠️  Error: ${data.error}\n`);
          continue;
        }

        console.log(`✅ Success!`);
        console.log(`   Format: ${data.format}`);
        console.log(`   Features: ${data.rows.length}`);
        console.log(`   Columns: ${data.columns.join(', ')}`);

        if (data.rows.length > 0) {
          console.log(`   Has geometry_type: ${data.columns.includes('geometry_type') ? 'YES' : 'NO'}`);
          console.log(`   Has geometry_coordinates: ${data.columns.includes('geometry_coordinates') ? 'YES' : 'NO'}`);
          console.log(`   Sample row keys: ${Object.keys(data.rows[0]).slice(0, 5).join(', ')}`);
        }
        console.log('');
        return true;
      }
    }

    console.log('⚠️  No accessible GeoJSON resources found\n');
    return false;

  } catch (error) {
    console.error('❌ GeoJSON test failed:', error.message);
    return false;
  }
}

async function testKML() {
  console.log('🗺️  Testing KML parsing\n');

  const api = new BerlinOpenDataAPI();
  const fetcher = new DataFetcher();

  try {
    // Search for KML datasets
    const results = await api.searchDatasets({ query: 'kml', limit: 5 });

    console.log(`Found ${results.count} KML datasets\n`);

    if (results.results.length === 0) {
      console.log('⏭️  No KML datasets found for testing\n');
      return false;
    }

    // Try first few datasets with KML resource
    for (const result of results.results) {
      const dataset = await api.getDataset(result.name);
      const kmlResource = dataset.resources.find(r => r.format === 'KML');

      if (kmlResource) {
        console.log(`Testing dataset: ${dataset.title}`);
        console.log(`Resource: ${kmlResource.name}`);
        console.log(`URL: ${kmlResource.url}`);

        const data = await fetcher.fetchResource(kmlResource.url, kmlResource.format);

        if (data.error) {
          console.log(`⚠️  Error: ${data.error}\n`);
          continue;
        }

        console.log(`✅ Success!`);
        console.log(`   Format: ${data.format}`);
        console.log(`   Placemarks: ${data.rows.length}`);
        console.log(`   Columns: ${data.columns.join(', ')}`);

        if (data.rows.length > 0) {
          console.log(`   Has geometry_type: ${data.columns.includes('geometry_type') ? 'YES' : 'NO'}`);
          console.log(`   Has geometry_coordinates: ${data.columns.includes('geometry_coordinates') ? 'YES' : 'NO'}`);
          console.log(`   Sample row keys: ${Object.keys(data.rows[0]).slice(0, 5).join(', ')}`);
        }
        console.log('');
        return true;
      }
    }

    console.log('⚠️  No accessible KML resources found\n');
    return false;

  } catch (error) {
    console.error('❌ KML test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Testing Geodata Format Support');
  console.log('='.repeat(60));
  console.log('');

  const geoJSONSuccess = await testGeoJSON();
  const kmlSuccess = await testKML();

  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`GeoJSON: ${geoJSONSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`KML:     ${kmlSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('');

  if (geoJSONSuccess && kmlSuccess) {
    console.log('🎉 All geodata format tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed or no accessible datasets found');
    process.exit(1);
  }
}

runTests();
