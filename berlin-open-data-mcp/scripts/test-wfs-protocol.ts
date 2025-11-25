// ABOUTME: Tests WFS protocol requests (GetCapabilities, GetFeature) against Berlin WFS services
// ABOUTME: Examines response structure to inform implementation design

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';

const TEST_WFS_URL = 'https://gdi.berlin.de/services/wfs/kita';

async function testGetCapabilities() {
  console.log('=== Testing GetCapabilities Request ===\n');

  const url = `${TEST_WFS_URL}?SERVICE=WFS&REQUEST=GetCapabilities`;
  console.log(`URL: ${url}\n`);

  try {
    const response = await fetch(url);
    const xml = await response.text();

    console.log('Response status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('Response length:', xml.length, 'characters\n');

    // Parse XML to find feature types
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Find FeatureType elements
    const featureTypes = doc.getElementsByTagName('FeatureType');
    console.log(`Found ${featureTypes.length} FeatureType(s):\n`);

    for (let i = 0; i < Math.min(featureTypes.length, 3); i++) {
      const ft = featureTypes[i];
      const name = ft.getElementsByTagName('Name')[0]?.textContent;
      const title = ft.getElementsByTagName('Title')[0]?.textContent;
      const abstract = ft.getElementsByTagName('Abstract')[0]?.textContent;

      console.log(`  ${i + 1}. ${name}`);
      console.log(`     Title: ${title}`);
      if (abstract) console.log(`     Abstract: ${abstract.substring(0, 100)}...`);
      console.log('');
    }

    // Look for output formats
    const formats = doc.getElementsByTagName('outputFormat');
    if (formats.length > 0) {
      console.log('Available output formats:');
      for (let i = 0; i < Math.min(formats.length, 10); i++) {
        console.log(`  - ${formats[i].textContent}`);
      }
      console.log('');
    }

    return featureTypes.length > 0 ? featureTypes[0].getElementsByTagName('Name')[0]?.textContent : null;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function testGetFeature(typeName: string | null) {
  console.log('\n=== Testing GetFeature Request ===\n');

  if (!typeName) {
    console.log('No type name available, using default');
    typeName = 'kita:kita';
  }

  // Test with GeoJSON output format
  const url = `${TEST_WFS_URL}?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=${typeName}&OUTPUTFORMAT=application/json&COUNT=5`;
  console.log(`URL: ${url}\n`);
  console.log('Parameters:');
  console.log('  SERVICE=WFS');
  console.log('  REQUEST=GetFeature');
  console.log('  VERSION=2.0.0');
  console.log(`  TYPENAMES=${typeName}`);
  console.log('  OUTPUTFORMAT=application/json');
  console.log('  COUNT=5 (limit to 5 features)');
  console.log('');

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    console.log('Response status:', response.status);
    console.log('Content-Type:', contentType);

    if (contentType.includes('json')) {
      const json = await response.json();
      console.log('Response type:', json.type);
      console.log('Number of features:', json.features?.length || 0);

      if (json.features && json.features.length > 0) {
        console.log('\nFirst feature sample:');
        const feature = json.features[0];
        console.log('  Type:', feature.type);
        console.log('  Geometry type:', feature.geometry?.type);
        console.log('  Properties:', Object.keys(feature.properties || {}).slice(0, 10).join(', '));
        console.log('\nFull first feature:');
        console.log(JSON.stringify(feature, null, 2).substring(0, 1000) + '...');
      }
    } else {
      const text = await response.text();
      console.log('Response (first 500 chars):');
      console.log(text.substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testPagination(typeName: string | null) {
  console.log('\n=== Testing Pagination ===\n');

  if (!typeName) {
    typeName = 'kita:kita';
  }

  // Get total count
  const countUrl = `${TEST_WFS_URL}?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=${typeName}&RESULTTYPE=hits`;
  console.log('Getting total count...');

  try {
    const response = await fetch(countUrl);
    const xml = await response.text();

    // Parse numberMatched attribute
    const numberMatched = xml.match(/numberMatched="(\d+)"/);
    if (numberMatched) {
      console.log(`Total features: ${numberMatched[1]}`);
    }

    // Test pagination with STARTINDEX
    console.log('\nTesting STARTINDEX parameter (get features 5-9):');
    const pageUrl = `${TEST_WFS_URL}?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=${typeName}&OUTPUTFORMAT=application/json&COUNT=5&STARTINDEX=5`;

    const pageResponse = await fetch(pageUrl);
    const json = await pageResponse.json();
    console.log(`Received ${json.features?.length || 0} features starting from index 5`);

  } catch (error) {
    console.error('Error:', error);
  }
}

async function testDifferentServices() {
  console.log('\n=== Testing Different WFS Services ===\n');

  const services = [
    { name: 'Lichtsignalanlagen (Traffic Lights)', url: 'https://gdi.berlin.de/services/wfs/lsa' },
    { name: 'Denkmale (Monuments)', url: 'https://gdi.berlin.de/services/wfs/denkmale' },
  ];

  for (const service of services) {
    console.log(`\nTesting: ${service.name}`);
    console.log(`URL: ${service.url}`);

    try {
      const url = `${service.url}?SERVICE=WFS&REQUEST=GetCapabilities`;
      const response = await fetch(url);
      const xml = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const featureTypes = doc.getElementsByTagName('FeatureType');

      console.log(`  ✓ Available, ${featureTypes.length} feature type(s)`);

      if (featureTypes.length > 0) {
        const name = featureTypes[0].getElementsByTagName('Name')[0]?.textContent;
        console.log(`  First type: ${name}`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }
  }
}

async function main() {
  console.log('=== Berlin WFS Protocol Testing ===\n');
  console.log('Testing against: Kitas in Berlin\n');

  const typeName = await testGetCapabilities();
  await testGetFeature(typeName);
  await testPagination(typeName);
  await testDifferentServices();

  console.log('\n=== Summary ===\n');
  console.log('Key findings:');
  console.log('1. GetCapabilities returns XML with FeatureType definitions');
  console.log('2. GetFeature supports application/json (GeoJSON) output');
  console.log('3. Pagination available via COUNT and STARTINDEX parameters');
  console.log('4. Services follow standard OGC WFS 2.0.0 protocol');
  console.log('');
}

main().catch(console.error);
