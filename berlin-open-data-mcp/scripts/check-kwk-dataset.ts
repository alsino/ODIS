// ABOUTME: Check KWK-Stromeinspeisung dataset resources
// ABOUTME: Verify which WFS URLs are actually in the portal for this dataset

import axios from 'axios';

const API = 'https://datenregister.berlin.de/api/3/action';

async function checkKWK() {
  const result = await axios.get(`${API}/package_show?id=kwk-stromeinspeisung-je-bezirk`);
  const dataset = result.data.result;

  console.log('Dataset:', dataset.title);
  console.log('Resources:\n');

  dataset.resources.forEach((r: any, i: number) => {
    console.log(`${i+1}. ${r.name}`);
    console.log(`   Format: ${r.format}`);
    console.log(`   URL: ${r.url}\n`);
  });
}

checkKWK().catch(console.error);
