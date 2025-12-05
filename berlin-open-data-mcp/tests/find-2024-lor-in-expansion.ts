// ABOUTME: Check if 2024 LOR dataset appears in expansion term searches
// ABOUTME: Diagnose why it's not appearing in results

import { BerlinOpenDataAPI } from '../src/berlin-api.js';

const api = new BerlinOpenDataAPI();
const TARGET_DATASET = 'einwohnerinnen-und-einwohner-in-berlin-in-lor-planungsraumen-am-31-12-2024';

const expansionTerms = [
  'Einwohnerinnen',
  'Kleinräumige einwohnerzahl',
  'Einwohnerdichte',
  'Einwohnerentwicklung',
  'Keinräumige einwohnerzahl'
];

async function checkExpansionTerms() {
  console.log(`Looking for dataset: ${TARGET_DATASET}\n`);

  for (const term of expansionTerms) {
    console.log(`Searching for "${term}"...`);
    const result = await api.searchDatasets({ query: term, limit: 100 });

    const found = result.results.find(d => d.name === TARGET_DATASET);

    if (found) {
      console.log(`  ✓ FOUND at position ${result.results.indexOf(found) + 1} of ${result.results.length}`);
      console.log(`    Title: ${found.title}`);
    } else {
      console.log(`  ✗ NOT FOUND in first 100 results (total: ${result.count})`);
    }
  }

  // Also try just "Einwohner"
  console.log(`\nSearching for "Einwohner"...`);
  const einwohnerResult = await api.searchDatasets({ query: 'Einwohner', limit: 100 });
  const foundEinwohner = einwohnerResult.results.find(d => d.name === TARGET_DATASET);

  if (foundEinwohner) {
    console.log(`  ✓ FOUND at position ${einwohnerResult.results.indexOf(foundEinwohner) + 1}`);
  } else {
    console.log(`  ✗ NOT FOUND in first 100 results`);
  }
}

checkExpansionTerms();
