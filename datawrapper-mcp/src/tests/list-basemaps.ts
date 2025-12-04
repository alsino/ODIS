// ABOUTME: Test script to list available Datawrapper base maps
// ABOUTME: Helps identify which base map to use for Berlin data

import { DatawrapperClient } from '../datawrapper-client.js';
import * as dotenv from 'dotenv';

dotenv.config();

const DATAWRAPPER_API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;

if (!DATAWRAPPER_API_TOKEN) {
  console.error('Error: DATAWRAPPER_API_TOKEN not found in environment');
  process.exit(1);
}

async function listBasemaps() {
  console.log('🗺️  Fetching available base maps from Datawrapper...\n');

  const client = new DatawrapperClient(DATAWRAPPER_API_TOKEN!);

  try {
    const basemaps = await client.getBasemaps();

    console.log(`Found ${basemaps.length} base maps\n`);

    // Filter for Berlin-related maps
    const berlinMaps = basemaps.filter((map: any) =>
      map.id?.toLowerCase().includes('berlin') ||
      map.title?.toLowerCase().includes('berlin')
    );

    if (berlinMaps.length > 0) {
      console.log('📍 Berlin-specific base maps:');
      berlinMaps.forEach((map: any) => {
        console.log(`\n  ID: ${map.id}`);
        console.log(`  Title: ${map.title || 'N/A'}`);
        console.log(`  Type: ${map.type || 'N/A'}`);
      });
    } else {
      console.log('⚠️  No Berlin-specific base maps found');
      console.log('\nShowing first 10 available base maps:');
      basemaps.slice(0, 10).forEach((map: any) => {
        console.log(`\n  ID: ${map.id}`);
        console.log(`  Title: ${map.title || 'N/A'}`);
      });
    }

    // Also check for Germany maps
    const germanyMaps = basemaps.filter((map: any) =>
      map.id?.toLowerCase().includes('germany') ||
      map.id?.toLowerCase().includes('deutschland') ||
      map.title?.toLowerCase().includes('germany') ||
      map.title?.toLowerCase().includes('deutschland')
    );

    if (germanyMaps.length > 0) {
      console.log('\n\n🇩🇪 Germany-related base maps:');
      germanyMaps.forEach((map: any) => {
        console.log(`\n  ID: ${map.id}`);
        console.log(`  Title: ${map.title || 'N/A'}`);
      });
    }

    // Save full list to file for reference
    const fs = await import('fs');
    fs.writeFileSync(
      'basemaps-list.json',
      JSON.stringify(basemaps, null, 2)
    );
    console.log('\n\n📄 Full base maps list saved to basemaps-list.json');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listBasemaps();
