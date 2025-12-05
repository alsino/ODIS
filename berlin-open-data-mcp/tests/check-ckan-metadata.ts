// ABOUTME: Check what metadata CKAN provides for sorting
// ABOUTME: Look for relevance scores, modification dates, etc.

import { BerlinOpenDataAPI } from '../src/berlin-api.js';

const api = new BerlinOpenDataAPI();

async function checkMetadata() {
  const result = await api.searchDatasets({ query: 'Einwohner Berlin', limit: 3 });

  console.log('Sample dataset metadata fields:\n');

  result.results.forEach((dataset, i) => {
    console.log(`Dataset ${i + 1}: ${dataset.title}`);
    console.log(`  id: ${dataset.id}`);
    console.log(`  name: ${dataset.name}`);
    console.log(`  metadata_created: ${dataset.metadata_created}`);
    console.log(`  metadata_modified: ${dataset.metadata_modified}`);
    console.log(`  temporal_coverage_from: ${dataset.temporal_coverage_from}`);
    console.log(`  temporal_coverage_to: ${dataset.temporal_coverage_to}`);
    console.log(`  Has search_score? ${dataset.search_score !== undefined}`);
    if (dataset.search_score) {
      console.log(`  search_score: ${dataset.search_score}`);
    }
    console.log();
  });
}

checkMetadata();
