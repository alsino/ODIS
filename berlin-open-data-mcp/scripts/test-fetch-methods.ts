// ABOUTME: Test different HTTP libraries with energieatlas
// ABOUTME: Compare node-fetch vs axios for handling the response

import fetch from 'node-fetch';
import axios from 'axios';

const URL = 'https://energieatlas.berlin.de/public/ogcsl.ashx?nodeId=298&SERVICE=WFS&REQUEST=GetCapabilities';

async function testNodeFetch() {
  console.log('=== Testing with node-fetch ===\n');

  try {
    const response = await fetch(URL);
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('First 200 chars:', text.substring(0, 200));
    console.log('✓ node-fetch succeeded\n');
  } catch (error) {
    console.log('❌ node-fetch failed:', error);
    console.log('');
  }
}

async function testAxios() {
  console.log('=== Testing with axios ===\n');

  try {
    const response = await axios.get(URL);
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);

    const text = response.data;
    console.log('Response length:', typeof text === 'string' ? text.length : 'not string');
    console.log('First 200 chars:', String(text).substring(0, 200));
    console.log('✓ axios succeeded\n');
  } catch (error) {
    console.log('❌ axios failed:', error);
    console.log('');
  }
}

async function main() {
  console.log(`Testing URL: ${URL}\n`);
  await testNodeFetch();
  await testAxios();
}

main().catch(console.error);
