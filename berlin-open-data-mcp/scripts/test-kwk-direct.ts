// ABOUTME: Direct test of KWK dataset to verify nodeId preservation works
// ABOUTME: Tests energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298

import { DataFetcher } from '../src/data-fetcher.js';

async function testKWK() {
  console.log('=== Testing KWK Dataset (energieatlas with nodeId) ===\n');
  console.log('URL: https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities\n');

  const fetcher = new DataFetcher();

  const result = await fetcher.fetchResource(
    'https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities',
    'WFS'
  );

  if (result.error) {
    console.log('❌ Error:', result.error);
    console.log('\nThis might be a transient network error. Retry once:\n');

    // Retry once
    const retry = await fetcher.fetchResource(
      'https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&Service=WFS&request=GetCapabilities',
      'WFS'
    );

    if (retry.error) {
      console.log('❌ Retry also failed:', retry.error);
    } else {
      console.log('✓ Retry succeeded!');
      console.log('  Format:', retry.format);
      console.log('  Rows:', retry.rows.length, '/', retry.totalRows);
      console.log('  Columns:', retry.columns.slice(0, 15).join(', '));

      if (retry.rows.length > 0) {
        console.log('\n  First row sample:');
        const firstRow = retry.rows[0];
        Object.keys(firstRow).slice(0, 5).forEach(key => {
          console.log(`    ${key}: ${firstRow[key]}`);
        });
      }
    }
  } else {
    console.log('✓ Success!');
    console.log('  Format:', result.format);
    console.log('  Rows:', result.rows.length, '/', result.totalRows);
    console.log('  Columns:', result.columns.slice(0, 15).join(', '));

    if (result.rows.length > 0) {
      console.log('\n  First row sample:');
      const firstRow = result.rows[0];
      Object.keys(firstRow).slice(0, 5).forEach(key => {
        console.log(`    ${key}: ${firstRow[key]}`);
      });
    }
  }
}

testKWK().catch(console.error);
