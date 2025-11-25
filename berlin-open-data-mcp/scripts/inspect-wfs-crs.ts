// ABOUTME: Inspect WFS GetCapabilities to identify coordinate reference system
// ABOUTME: Check what CRS is being used by Berlin WFS services

import axios from 'axios';
import { DOMParser } from '@xmldom/xmldom';

const URLS = [
  'https://gdi.berlin.de/services/wfs/alkis_ortsteile',
  'https://gdi.berlin.de/services/wfs/kita',
];

async function inspectWFSCRS(url: string) {
  console.log(`\n=== Inspecting: ${url} ===\n`);

  // GetCapabilities request
  const capUrl = `${url}?SERVICE=WFS&REQUEST=GetCapabilities`;
  const response = await axios.get(capUrl);
  const xml = response.data;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Look for DefaultCRS or CRS elements
  console.log('Looking for CRS information...\n');

  // Try different CRS element names
  const crsElements = [
    ...Array.from(doc.getElementsByTagName('DefaultCRS')),
    ...Array.from(doc.getElementsByTagName('DefaultSRS')),
    ...Array.from(doc.getElementsByTagName('CRS')),
    ...Array.from(doc.getElementsByTagName('SRS')),
  ];

  const crsValues = new Set<string>();
  crsElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text) crsValues.add(text);
  });

  if (crsValues.size > 0) {
    console.log('Found CRS values:');
    crsValues.forEach(crs => console.log(`  - ${crs}`));
  } else {
    console.log('No CRS information found in GetCapabilities');
  }

  // Also check GetFeature response for actual coordinate values
  console.log('\n=== Checking GetFeature Response ===\n');

  // Find first feature type
  const ftElements = doc.getElementsByTagName('FeatureType');
  if (ftElements.length > 0) {
    const nameEl = ftElements[0].getElementsByTagName('Name')[0];
    const typeName = nameEl?.textContent?.trim();

    if (typeName) {
      const featureUrl = `${url}?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=${typeName}&COUNT=1&OUTPUTFORMAT=application/json`;
      const featureResp = await axios.get(featureUrl);
      const geojson = featureResp.data;

      if (geojson.crs) {
        console.log('GeoJSON CRS object:', JSON.stringify(geojson.crs, null, 2));
      } else {
        console.log('No CRS in GeoJSON (assumes WGS84 per spec)');
      }

      if (geojson.features?.[0]?.geometry?.coordinates) {
        const coords = geojson.features[0].geometry.coordinates;
        const flatCoords = JSON.stringify(coords).match(/\d+\.\d+/g)?.slice(0, 4) || [];
        console.log('\nSample coordinate values:', flatCoords.join(', '));

        // Heuristic: if coordinates > 180, likely projected
        const firstCoord = parseFloat(flatCoords[0] || '0');
        if (firstCoord > 180) {
          console.log('→ These look like PROJECTED coordinates (not lat/lon)');
          console.log('→ Likely EPSG:25833 (ETRS89 / UTM zone 33N - Berlin standard)');
        } else {
          console.log('→ These look like WGS84 lat/lon coordinates');
        }
      }
    }
  }
}

async function main() {
  console.log('=== WFS Coordinate Reference System Inspector ===');

  for (const url of URLS) {
    try {
      await inspectWFSCRS(url);
    } catch (error) {
      console.log(`\nError inspecting ${url}:`, error);
    }
  }
}

main().catch(console.error);
