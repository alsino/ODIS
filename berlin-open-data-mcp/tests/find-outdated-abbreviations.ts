// ABOUTME: Find datasets with outdated Senate administration abbreviations
// ABOUTME: Document examples for bug report

import { BerlinOpenDataAPI } from '../src/berlin-api.js';

const api = new BerlinOpenDataAPI();

async function findOutdatedAbbreviations() {
  console.log('Finding datasets with outdated Senate administration abbreviations...\n');

  // Known outdated abbreviations
  const outdatedAbbrevs = [
    { old: 'SenGEPF', new: 'SenWGP', oldName: 'Gesundheit, Pflege und Gleichstellung', newName: 'Wissenschaft, Gesundheit und Pflege' },
    { old: 'SenIAS', new: 'SenASGIVA', oldName: 'Integration, Arbeit und Soziales', newName: 'Arbeit, Soziales, Gleichstellung, Integration, Vielfalt und Antidiskriminierung' },
    { old: 'SenUVK', new: 'SenMVKU', oldName: 'Umwelt, Verkehr und Klimaschutz', newName: 'Mobilität, Verkehr, Klimaschutz und Umwelt' }
  ];

  for (const abbrev of outdatedAbbrevs) {
    console.log(`\n=== ${abbrev.old} (outdated) → ${abbrev.new} (current) ===`);
    console.log(`Old: Senatsverwaltung für ${abbrev.oldName}`);
    console.log(`New: Senatsverwaltung für ${abbrev.newName}\n`);

    const result = await api.searchDatasets({ query: abbrev.old, limit: 5 });
    console.log(`Found ${result.count} datasets with "${abbrev.old}"\n`);

    result.results.slice(0, 3).forEach(dataset => {
      console.log(`📄 ${dataset.title}`);
      console.log(`   ID: ${dataset.name}`);
      console.log(`   URL: https://daten.berlin.de/datensaetze/${dataset.name}`);

      if (dataset.author) {
        console.log(`   Author: ${dataset.author}`);
      }

      // Check where the abbreviation appears
      const inTitle = dataset.title.toLowerCase().includes(abbrev.old.toLowerCase());
      const inNotes = dataset.notes?.toLowerCase().includes(abbrev.old.toLowerCase());

      if (inTitle) console.log(`   ⚠️  Abbreviation in TITLE`);
      if (inNotes) console.log(`   ⚠️  Abbreviation in DESCRIPTION`);

      console.log();
    });
  }
}

findOutdatedAbbreviations();
