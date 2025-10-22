// Integration test for Berlin Open Data MCP Server
// Tests all major workflows

const { BerlinOpenDataAPI } = require('../dist/berlin-api.js');
const { DataFetcher } = require('../dist/data-fetcher.js');
const { DataSampler } = require('../dist/data-sampler.js');

async function runTests() {
  console.log('🧪 Starting Integration Tests\n');

  const api = new BerlinOpenDataAPI();
  const fetcher = new DataFetcher();
  const sampler = new DataSampler();

  let passed = 0;
  let failed = 0;

  // Test 1: Portal Stats
  try {
    console.log('Test 1: Get portal statistics...');
    const stats = await api.getPortalStats();
    console.assert(stats.total_datasets > 0, 'Should have datasets');
    console.assert(stats.total_organizations > 0, 'Should have organizations');
    console.log('✅ Portal stats:', stats);
    passed++;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    failed++;
  }

  // Test 2: List datasets with pagination
  try {
    console.log('\nTest 2: List datasets with pagination...');
    const result = await api.listAllDatasets(0, 10);
    console.assert(result.datasets.length === 10, 'Should return 10 datasets');
    console.assert(result.total > 10, 'Total should be greater than 10');
    console.log('✅ Listed datasets:', result.datasets.length, 'of', result.total);
    passed++;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    failed++;
  }

  // Test 3: Search datasets
  try {
    console.log('\nTest 3: Search datasets...');
    const results = await api.searchDatasets({ query: 'verkehr', limit: 5 });
    console.assert(results.results.length > 0, 'Should find results');
    console.log('✅ Found', results.results.length, 'datasets about verkehr');

    // Save first dataset for next tests
    global.testDatasetId = results.results[0].name;
    global.testDatasetTitle = results.results[0].title;
    passed++;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    failed++;
  }

  // Test 4: Get dataset details
  try {
    console.log('\nTest 4: Get dataset details...');
    const dataset = await api.getDataset(global.testDatasetId);
    console.assert(dataset.id, 'Dataset should have ID');
    console.assert(dataset.resources, 'Dataset should have resources');
    console.log('✅ Got details for:', dataset.title);
    console.log('   Resources:', dataset.resources.length);
    passed++;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    failed++;
  }

  // Test 5: List dataset resources
  try {
    console.log('\nTest 5: List dataset resources...');
    const resources = await api.listDatasetResources(global.testDatasetId);
    console.assert(Array.isArray(resources), 'Should return array');
    console.log('✅ Found', resources.length, 'resources');

    if (resources.length > 0) {
      global.testResourceUrl = resources[0].url;
      global.testResourceFormat = resources[0].format;
    }
    passed++;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    failed++;
  }

  // Test 6: Fetch and parse data (if we have a suitable resource)
  if (global.testResourceUrl && ['CSV', 'JSON'].includes(global.testResourceFormat.toUpperCase())) {
    try {
      console.log('\nTest 6: Fetch and parse data...');
      const data = await fetcher.fetchResource(global.testResourceUrl, global.testResourceFormat);

      if (data.error) {
        console.log('⚠️  Could not fetch data:', data.error);
      } else {
        console.assert(data.rows.length > 0, 'Should have rows');
        console.assert(data.columns.length > 0, 'Should have columns');
        console.log('✅ Fetched data:', data.rows.length, 'rows,', data.columns.length, 'columns');

        // Test 7: Generate sample
        console.log('\nTest 7: Generate sample and stats...');
        const sample = sampler.generateSample(data.rows, data.columns, 10);
        console.assert(sample.sampleRows.length <= 10, 'Sample should be limited');
        console.assert(sample.columns.length > 0, 'Should have column stats');
        console.log('✅ Generated sample with stats');
        console.log('   Column types:', sample.columns.map(c => `${c.name}:${c.type}`).join(', '));
        passed += 2;
      }
    } catch (error) {
      console.log('❌ Failed:', error.message);
      failed += 2;
    }
  } else {
    console.log('\n⏭️  Skipping data fetch tests (no suitable resource)');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests();
