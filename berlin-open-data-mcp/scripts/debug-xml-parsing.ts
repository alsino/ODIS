// ABOUTME: Debug XML parsing for energieatlas GetCapabilities response
// ABOUTME: Check if FeatureType elements are being found correctly

import axios from 'axios';
import { DOMParser } from '@xmldom/xmldom';

const URL = 'https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&SERVICE=WFS&REQUEST=GetCapabilities';

async function debugXMLParsing() {
  console.log('=== Debugging XML Parsing ===\n');

  const response = await axios.get(URL);
  const xml = response.data;

  console.log('Response type:', typeof xml);
  console.log('Response length:', String(xml).length);
  console.log('First 500 chars:');
  console.log(String(xml).substring(0, 500));
  console.log('\n');

  // Parse XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xml), 'text/xml');

  console.log('Parsed document type:', doc.constructor.name);

  // Try different ways to find FeatureType
  console.log('\nTrying getElementsByTagName("FeatureType"):');
  const ft1 = doc.getElementsByTagName('FeatureType');
  console.log(`  Found: ${ft1.length} elements`);

  console.log('\nTrying getElementsByTagName("wfs:FeatureType"):');
  const ft2 = doc.getElementsByTagName('wfs:FeatureType');
  console.log(`  Found: ${ft2.length} elements`);

  console.log('\nTrying getElementsByTagNameNS:');
  const ft3 = doc.getElementsByTagNameNS('http://www.opengis.net/wfs/2.0', 'FeatureType');
  console.log(`  Found: ${ft3.length} elements`);

  if (ft3.length > 0) {
    console.log('\n  First FeatureType (with NS):');
    const ft = ft3[0];
    const name = ft.getElementsByTagNameNS('http://www.opengis.net/wfs/2.0', 'Name')[0]?.textContent;
    const title = ft.getElementsByTagNameNS('http://www.opengis.net/wfs/2.0', 'Title')[0]?.textContent;
    console.log(`    Name: ${name}`);
    console.log(`    Title: ${title}`);
  }

  // Also try without NS
  if (ft1.length > 0) {
    console.log('\n  First FeatureType (without NS):');
    const ft = ft1[0];
    const name = ft.getElementsByTagName('Name')[0]?.textContent || ft.getElementsByTagName('wfs:Name')[0]?.textContent;
    const title = ft.getElementsByTagName('Title')[0]?.textContent || ft.getElementsByTagName('wfs:Title')[0]?.textContent;
    console.log(`    Name: ${name}`);
    console.log(`    Title: ${title}`);
  }
}

debugXMLParsing().catch(console.error);
