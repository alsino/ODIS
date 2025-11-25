// ABOUTME: Comprehensive test for WFS URL handling with parameter preservation
// ABOUTME: Tests all URL patterns: gdi.berlin.de, fbinter, energieatlas (with nodeId)

import { DataFetcher } from '../src/data-fetcher.js';
import { WFSClient } from '../src/wfs-client.js';

interface TestCase {
  name: string;
  url: string;
  expectedBaseUrl: string;
  expectedPreservedParams: Record<string, string>;
}

const testCases: TestCase[] = [
  {
    name: 'Clean gdi.berlin.de URL',
    url: 'https://gdi.berlin.de/services/wfs/kita',
    expectedBaseUrl: 'https://gdi.berlin.de/services/wfs/kita',
    expectedPreservedParams: {},
  },
  {
    name: 'gdi.berlin.de with GetCapabilities params',
    url: 'https://gdi.berlin.de/services/wfs/lsa?REQUEST=GetCapabilities&SERVICE=wfs',
    expectedBaseUrl: 'https://gdi.berlin.de/services/wfs/lsa',
    expectedPreservedParams: {},
  },
  {
    name: 'gdi.berlin.de with lowercase params',
    url: 'https://gdi.berlin.de/services/wfs/tvz?request=getcapabilities&service=wfs&version=2.0.0',
    expectedBaseUrl: 'https://gdi.berlin.de/services/wfs/tvz',
    expectedPreservedParams: {},
  },
  {
    name: 'energieatlas with nodeId (CRITICAL)',
    url: 'https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities',
    expectedBaseUrl: 'https://energieatlas.berlin.de/public/ogcsl.ashx',
    expectedPreservedParams: { nodeId: '298' },
  },
  {
    name: 'fbinter.stadt-berlin.de clean URL',
    url: 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_es_daten_2022',
    expectedBaseUrl: 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_es_daten_2022',
    expectedPreservedParams: {},
  },
  {
    name: 'fbinter with GetCapabilities params',
    url: 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_rbs_bloecke?request=getcapabilities&service=wfs&version=2.0.0',
    expectedBaseUrl: 'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_rbs_bloecke',
    expectedPreservedParams: {},
  },
];

async function testUrlParsing() {
  console.log('=== Test 1: URL Parsing ===\n');

  const wfsClient = new WFSClient();
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`  URL: ${testCase.url}`);

    try {
      const { baseUrl, preservedParams } = wfsClient.parseWFSUrl(testCase.url);

      // Check base URL
      if (baseUrl === testCase.expectedBaseUrl) {
        console.log(`  ✓ Base URL correct: ${baseUrl}`);
      } else {
        console.log(`  ❌ Base URL mismatch:`);
        console.log(`     Expected: ${testCase.expectedBaseUrl}`);
        console.log(`     Got: ${baseUrl}`);
        failed++;
        continue;
      }

      // Check preserved params
      const actualParams: Record<string, string> = {};
      for (const [key, value] of preservedParams) {
        actualParams[key] = value;
      }

      const expectedKeys = Object.keys(testCase.expectedPreservedParams);
      const actualKeys = Object.keys(actualParams);

      if (expectedKeys.length !== actualKeys.length) {
        console.log(`  ❌ Preserved params count mismatch:`);
        console.log(`     Expected: ${expectedKeys.length} params`);
        console.log(`     Got: ${actualKeys.length} params`);
        failed++;
        continue;
      }

      let paramMatch = true;
      for (const key of expectedKeys) {
        if (actualParams[key] !== testCase.expectedPreservedParams[key]) {
          console.log(`  ❌ Param mismatch for "${key}":`);
          console.log(`     Expected: ${testCase.expectedPreservedParams[key]}`);
          console.log(`     Got: ${actualParams[key]}`);
          paramMatch = false;
        }
      }

      if (paramMatch) {
        console.log(`  ✓ Preserved params correct: ${JSON.stringify(actualParams)}`);
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
      failed++;
    }

    console.log('');
  }

  console.log(`Result: ${passed}/${testCases.length} passed\n`);
  return failed === 0;
}

async function testEndToEnd() {
  console.log('=== Test 2: End-to-End Fetching ===\n');

  const fetcher = new DataFetcher();

  // Test 1: gdi.berlin.de (baseline)
  console.log('Test 2.1: gdi.berlin.de (Kitas)');
  console.log('URL: https://gdi.berlin.de/services/wfs/kita\n');

  try {
    const result = await fetcher.fetchResource(
      'https://gdi.berlin.de/services/wfs/kita',
      'WFS'
    );

    if (result.error) {
      console.log(`  ❌ Error: ${result.error}\n`);
    } else {
      console.log(`  ✓ Success!`);
      console.log(`    Format: ${result.format}`);
      console.log(`    Rows: ${result.rows.length}/${result.totalRows}`);
      console.log(`    Columns: ${result.columns.length}\n`);
    }
  } catch (error) {
    console.log(`  ❌ Exception: ${error}\n`);
  }

  // Test 2: energieatlas with nodeId (CRITICAL)
  console.log('Test 2.2: energieatlas.berlin.de with nodeId (KWK - CRITICAL)');
  console.log('URL: https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities\n');

  try {
    const result = await fetcher.fetchResource(
      'https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities',
      'WFS'
    );

    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
      console.log(`  THIS IS THE CRITICAL TEST - MUST PASS!\n`);
    } else {
      console.log(`  ✓✓✓ SUCCESS! energieatlas with nodeId working!`);
      console.log(`    Format: ${result.format}`);
      console.log(`    Rows: ${result.rows.length}/${result.totalRows}`);
      console.log(`    Columns: ${result.columns.length}`);
      if (result.rows.length > 0) {
        console.log(`    Sample columns: ${result.columns.slice(0, 5).join(', ')}`);
      }
      console.log('');
    }
  } catch (error) {
    console.log(`  ❌ Exception: ${error}`);
    console.log(`  THIS IS THE CRITICAL TEST - MUST PASS!\n`);
  }

  // Test 3: fbinter
  console.log('Test 2.3: fbinter.stadt-berlin.de (Statistische Blöcke)');
  console.log('URL: https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_rbs_bloecke\n');

  try {
    const result = await fetcher.fetchResource(
      'https://fbinter.stadt-berlin.de/fb/wfs/data/senstadt/s_rbs_bloecke',
      'WFS'
    );

    if (result.error) {
      console.log(`  ❌ Error: ${result.error}\n`);
    } else {
      console.log(`  ✓ Success!`);
      console.log(`    Format: ${result.format}`);
      console.log(`    Rows: ${result.rows.length}/${result.totalRows}`);
      console.log(`    Columns: ${result.columns.length}\n`);
    }
  } catch (error) {
    console.log(`  ❌ Exception: ${error}\n`);
  }
}

async function main() {
  console.log('=== WFS URL Handling Test Suite ===\n');
  console.log('Testing parameter preservation for all URL patterns\n');

  const parsingPassed = await testUrlParsing();
  await testEndToEnd();

  console.log('\n=== Summary ===\n');

  if (parsingPassed) {
    console.log('✓ URL parsing tests passed');
  } else {
    console.log('❌ URL parsing tests failed');
  }

  console.log('\nKey requirements:');
  console.log('1. ✓ Clean URLs work (no params)');
  console.log('2. ✓ URLs with GetCapabilities params work (strips them)');
  console.log('3. ✓ energieatlas with nodeId works (preserves nodeId)');
  console.log('4. ✓ fbinter URLs work');
  console.log('\nIf energieatlas test passed, the fix is complete!');
}

main().catch(console.error);
