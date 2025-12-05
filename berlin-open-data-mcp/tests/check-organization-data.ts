// ABOUTME: Check what organization data CKAN returns
// ABOUTME: Investigate Senate administration abbreviation issues

import { BerlinOpenDataAPI } from '../src/berlin-api.js';

const api = new BerlinOpenDataAPI();

async function checkOrganizationData() {
  console.log('Fetching dataset with organization information...\n');

  // Search for a dataset
  const searchResult = await api.searchDatasets({ query: 'Schule', limit: 5 });

  for (const dataset of searchResult.results) {
    console.log(`Dataset: ${dataset.title}`);
    console.log(`  ID: ${dataset.name}`);

    if (dataset.organization) {
      console.log(`  Organization object:`);
      console.log(`    - title: ${dataset.organization.title}`);
      console.log(`    - name: ${dataset.organization.name}`);
      console.log(`    - id: ${dataset.organization.id}`);
      console.log(`    Full object:`, JSON.stringify(dataset.organization, null, 2));
    } else {
      console.log(`  Organization: None`);
    }

    if (dataset.author) {
      console.log(`  Author: ${dataset.author}`);
    }
    if (dataset.maintainer) {
      console.log(`  Maintainer: ${dataset.maintainer}`);
    }
    console.log();
  }

  // Also check organization list
  console.log('\n--- Organization List ---\n');
  const stats = await api.getPortalStats();
  console.log(`Total organizations: ${stats.total_organizations}`);
}

checkOrganizationData();
