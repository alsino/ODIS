// ABOUTME: Test script to investigate search ranking behavior
// ABOUTME: Helps debug why certain datasets rank higher than expected

import { BerlinOpenDataAPI } from '../src/berlin-api.js';
import { QueryProcessor } from '../src/query-processor.js';

interface RankedDataset {
  title: string;
  name: string;
  matchCount: number;
  recencyBoost: number;
  finalScore: number;
  year: number | null;
}

class SearchRankingTester {
  private api: BerlinOpenDataAPI;
  private queryProcessor: QueryProcessor;

  constructor() {
    this.api = new BerlinOpenDataAPI();
    this.queryProcessor = new QueryProcessor();
  }

  /**
   * Extract the most recent year from a dataset title
   */
  private extractYear(titleText: string): number | null {
    const years = titleText.match(/\b(20\d{2})\b/g);
    if (years && years.length > 0) {
      return Math.max(...years.map(y => parseInt(y)));
    }
    return null;
  }

  /**
   * Calculate recency boost for a dataset
   */
  private calculateRecencyBoost(year: number | null): number {
    if (!year) return 0;

    const currentYear = new Date().getFullYear();
    const yearsDiff = currentYear - year;

    if (yearsDiff === 0) return 50;
    if (yearsDiff === 1) return 40;
    if (yearsDiff === 2) return 30;
    if (yearsDiff <= 5) return 20;
    if (yearsDiff <= 10) return 10;
    return 0;
  }

  /**
   * Test search ranking for a specific query
   */
  async testQuery(query: string): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log(`TESTING QUERY: "${query}"`);
    console.log('='.repeat(80));

    // Step 1: Expansion search
    const searchTerms = this.queryProcessor.extractSearchTerms(query);
    console.log(`\n📝 Expanded search terms: ${searchTerms.join(', ')}`);

    // Search for each term separately
    const searchPromises = searchTerms.map(term =>
      this.api.searchDatasets({ query: term, limit: 100 })
    );

    const allResults = await Promise.all(searchPromises);

    // Merge and deduplicate
    const datasetMap = new Map<string, { dataset: any; matchCount: number }>();

    allResults.forEach((result, termIndex) => {
      console.log(`\n  Term "${searchTerms[termIndex]}" found ${result.results.length} datasets`);

      result.results.forEach(dataset => {
        if (datasetMap.has(dataset.id)) {
          datasetMap.get(dataset.id)!.matchCount++;
        } else {
          datasetMap.set(dataset.id, { dataset, matchCount: 1 });
        }
      });
    });

    console.log(`\n✓ Total unique datasets found: ${datasetMap.size}`);

    // Step 2: Apply recency boost
    const rankedDatasets: RankedDataset[] = [];

    for (const item of datasetMap.values()) {
      const dataset = item.dataset;
      const titleText = `${dataset.title} ${dataset.name}`;
      const year = this.extractYear(titleText);
      const recencyBoost = this.calculateRecencyBoost(year);
      const finalScore = item.matchCount + recencyBoost;

      rankedDatasets.push({
        title: dataset.title,
        name: dataset.name,
        matchCount: item.matchCount,
        recencyBoost,
        finalScore,
        year
      });
    }

    // Sort by final score
    rankedDatasets.sort((a, b) => b.finalScore - a.finalScore);

    // Show top 10 results with detailed scoring
    console.log('\n📊 TOP 10 RESULTS (with scoring breakdown):');
    console.log('-'.repeat(80));

    rankedDatasets.slice(0, 10).forEach((dataset, index) => {
      console.log(`\n${index + 1}. ${dataset.title}`);
      console.log(`   ID: ${dataset.name}`);
      console.log(`   Year: ${dataset.year || 'N/A'}`);
      console.log(`   Match count: ${dataset.matchCount}`);
      console.log(`   Recency boost: +${dataset.recencyBoost}`);
      console.log(`   FINAL SCORE: ${dataset.finalScore}`);
    });

    // Highlight specific problematic cases
    console.log('\n🔍 SPECIFIC CASE ANALYSIS:');
    console.log('-'.repeat(80));

    const dataset2020 = rankedDatasets.find(d =>
      d.title.includes('Ortsteilen') && d.year === 2020
    );

    const dataset2024 = rankedDatasets.find(d =>
      d.title.includes('LOR-Planungsräumen') && d.year === 2024
    );

    if (dataset2020) {
      console.log('\n❌ 2020 Dataset (should rank LOWER):');
      console.log(`   Title: ${dataset2020.title}`);
      console.log(`   Match count: ${dataset2020.matchCount}`);
      console.log(`   Recency boost: +${dataset2020.recencyBoost}`);
      console.log(`   Final score: ${dataset2020.finalScore}`);
      const rank = rankedDatasets.indexOf(dataset2020) + 1;
      console.log(`   CURRENT RANK: #${rank}`);
    }

    if (dataset2024) {
      console.log('\n✓ 2024 Dataset (should rank HIGHER):');
      console.log(`   Title: ${dataset2024.title}`);
      console.log(`   Match count: ${dataset2024.matchCount}`);
      console.log(`   Recency boost: +${dataset2024.recencyBoost}`);
      console.log(`   Final score: ${dataset2024.finalScore}`);
      const rank = rankedDatasets.indexOf(dataset2024) + 1;
      console.log(`   CURRENT RANK: #${rank}`);
    }

    if (dataset2020 && dataset2024) {
      console.log('\n⚖️  COMPARISON:');
      const scoreDiff = dataset2024.finalScore - dataset2020.finalScore;
      const matchDiff = dataset2024.matchCount - dataset2020.matchCount;
      const boostDiff = dataset2024.recencyBoost - dataset2020.recencyBoost;

      console.log(`   Score difference: ${scoreDiff > 0 ? '+' : ''}${scoreDiff}`);
      console.log(`   Match count difference: ${matchDiff > 0 ? '+' : ''}${matchDiff}`);
      console.log(`   Recency boost difference: ${boostDiff > 0 ? '+' : ''}${boostDiff}`);

      if (scoreDiff < 0) {
        console.log('\n   ⚠️  PROBLEM: 2020 dataset scores higher than 2024!');
        console.log(`   The 2020 dataset has ${Math.abs(matchDiff)} more term matches`);
        console.log(`   But the recency boost (+${boostDiff}) is not enough to overcome this`);
      } else {
        console.log('\n   ✓ Ranking is correct: 2024 dataset scores higher');
      }
    }
  }

  async run(): Promise<void> {
    try {
      // Test the problematic query
      await this.testQuery('Was ist die Bevölkerungszahl von Marzahn-Hellersdorf?');

      // Test simpler query
      await this.testQuery('Bevölkerung');

      // Test with explicit year
      await this.testQuery('Bevölkerung 2024');

    } catch (error) {
      console.error('❌ Error during testing:', error);
      throw error;
    }
  }
}

// Run if executed directly
const tester = new SearchRankingTester();
tester.run();
