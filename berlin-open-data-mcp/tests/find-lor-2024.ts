// ABOUTME: Quick script to find the 2024 LOR population dataset
// ABOUTME: Checks if it exists and what its exact title is

import { BerlinOpenDataAPI } from '../src/berlin-api.js';

const api = new BerlinOpenDataAPI();

async function findDataset() {
  console.log('Searching for 2024 LOR population datasets...\n');

  // Try different search terms
  const searches = [
    'LOR-Planungsräumen 2024',
    'Einwohner LOR 2024',
    'LOR Planungsräumen Einwohner 2024',
    'Einwohnerinnen Einwohner Berlin LOR Planungsräumen 2024'
  ];

  for (const query of searches) {
    console.log(`\nSearching: "${query}"`);
    const result = await api.searchDatasets({ query, limit: 10 });
    console.log(`Found ${result.count} results`);

    result.results.forEach((dataset, i) => {
      if (dataset.title.includes('2024') && dataset.title.includes('LOR')) {
        console.log(`  ${i + 1}. ${dataset.title}`);
        console.log(`     ID: ${dataset.name}`);
      }
    });
  }
}

findDataset();
