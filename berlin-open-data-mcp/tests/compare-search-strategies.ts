// ABOUTME: Compare different search strategies to understand what works best
// ABOUTME: Tests CKAN's native search vs our expansion approach

import { BerlinOpenDataAPI } from '../src/berlin-api.js';
import { QueryProcessor } from '../src/query-processor.js';

const api = new BerlinOpenDataAPI();
const queryProcessor = new QueryProcessor();

async function compareSearches(query: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`QUERY: "${query}"`);
  console.log('='.repeat(80));

  // Strategy 1: CKAN's native search (what they return directly)
  console.log('\n📍 STRATEGY 1: CKAN Native Search (literal query)');
  console.log('-'.repeat(80));

  const nativeResult = await api.searchDatasets({ query, limit: 10 });
  console.log(`Found ${nativeResult.count} total results\n`);

  nativeResult.results.forEach((dataset, i) => {
    const year = dataset.title.match(/\b(20\d{2})\b/g);
    console.log(`${i + 1}. ${dataset.title}`);
    console.log(`   ID: ${dataset.name}`);
    console.log(`   Year: ${year ? Math.max(...year.map((y: string) => parseInt(y))) : 'N/A'}`);
  });

  // Strategy 2: Our expansion search
  console.log('\n\n📍 STRATEGY 2: Our Expansion Search');
  console.log('-'.repeat(80));

  const searchTerms = queryProcessor.extractSearchTerms(query);
  console.log(`Expanded terms: ${searchTerms.join(', ')}\n`);

  const searchPromises = searchTerms.map(term =>
    api.searchDatasets({ query: term, limit: 10 })
  );

  const allResults = await Promise.all(searchPromises);

  const datasetMap = new Map<string, { dataset: any; matchCount: number }>();

  allResults.forEach(result => {
    result.results.forEach(dataset => {
      if (datasetMap.has(dataset.id)) {
        datasetMap.get(dataset.id)!.matchCount++;
      } else {
        datasetMap.set(dataset.id, { dataset, matchCount: 1 });
      }
    });
  });

  const sortedResults = Array.from(datasetMap.values())
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 10);

  console.log(`Found ${datasetMap.size} unique datasets\n`);

  sortedResults.forEach((item, i) => {
    const year = item.dataset.title.match(/\b(20\d{2})\b/g);
    console.log(`${i + 1}. ${item.dataset.title}`);
    console.log(`   ID: ${item.dataset.name}`);
    console.log(`   Year: ${year ? Math.max(...year.map((y: string) => parseInt(y))) : 'N/A'}`);
    console.log(`   Matches: ${item.matchCount} terms`);
  });

  // Strategy 3: Single combined query with all expansion terms
  console.log('\n\n📍 STRATEGY 3: Combined Expansion (all terms in one query)');
  console.log('-'.repeat(80));

  const combinedQuery = searchTerms.join(' ');
  console.log(`Combined query: "${combinedQuery}"\n`);

  const combinedResult = await api.searchDatasets({ query: combinedQuery, limit: 10 });
  console.log(`Found ${combinedResult.count} total results\n`);

  combinedResult.results.forEach((dataset, i) => {
    const year = dataset.title.match(/\b(20\d{2})\b/g);
    console.log(`${i + 1}. ${dataset.title}`);
    console.log(`   ID: ${dataset.name}`);
    console.log(`   Year: ${year ? Math.max(...year.map((y: string) => parseInt(y))) : 'N/A'}`);
  });
}

async function run() {
  await compareSearches('Bevölkerung');
  await compareSearches('Bevölkerung Marzahn-Hellersdorf');
  await compareSearches('Einwohner Berlin');
}

run();
