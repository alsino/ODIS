// ABOUTME: Search for datasets with SenGEPF to understand the bug
// ABOUTME: Check if CKAN data has wrong abbreviations

import { BerlinOpenDataAPI } from '../src/berlin-api.js';

const api = new BerlinOpenDataAPI();

async function searchForIssue() {
  console.log('Searching for datasets with Senate administration references...\n');

  // Search for various terms
  const searches = ['SenGEPF', 'SenBJF', 'Senatsverwaltung Bildung'];

  for (const term of searches) {
    console.log(`\n=== Searching: "${term}" ===`);
    const result = await api.searchDatasets({ query: term, limit: 3 });
    console.log(`Found ${result.count} results\n`);

    for (const dataset of result.results) {
      console.log(`${dataset.title}`);
      if (dataset.author) {
        console.log(`  Author: ${dataset.author}`);
      }
      if (dataset.maintainer) {
        console.log(`  Maintainer: ${dataset.maintainer}`);
      }
      if (dataset.organization?.title) {
        console.log(`  Organization: ${dataset.organization.title}`);
      }
    }
  }
}

searchForIssue();
