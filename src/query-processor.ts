// ABOUTME: Processes natural language queries into structured search parameters
// ABOUTME: Maps English and German keywords to relevant dataset tags and categories

import { DatasetSearchParams } from './types.js';

export class QueryProcessor {
  private readonly KEYWORDS_MAP = {
    bicycle: ['fahrrad', 'bike', 'bicycle', 'cycling', 'radweg', 'bikesharing', 'rad', 'radverkehr', 'radfahrer'],
    traffic: ['verkehr', 'traffic', 'transport', 'mobility', 'straße', 'autobahn'],
    environment: ['umwelt', 'environment', 'luftqualität', 'air quality', 'pollution', 'klima', 'climate'],
    housing: ['wohnung', 'housing', 'miete', 'rent', 'immobilien', 'real estate'],
    demographics: ['bevölkerung', 'population', 'demographics', 'einwohner', 'residents'],
    education: ['bildung', 'education', 'schule', 'school', 'university', 'universität'],
    health: ['gesundheit', 'health', 'krankenhaus', 'hospital', 'medical'],
    crime: ['kriminalität', 'crime', 'safety', 'sicherheit', 'polizei', 'police'],
    economy: ['wirtschaft', 'economy', 'business', 'employment', 'arbeitsplatz', 'jobs'],
    culture: ['kultur', 'culture', 'museum', 'theater', 'art', 'kunst'],
    energy: ['energie', 'energy', 'strom', 'electricity', 'gas', 'renewable'],
    waste: ['müll', 'waste', 'recycling', 'abfall', 'garbage'],
    water: ['wasser', 'water', 'sewage', 'abwasser', 'drinking water'],
    parks: ['park', 'grün', 'green', 'forest', 'wald', 'recreation']
  };

  private readonly LOCATION_KEYWORDS = [
    'berlin', 'bezirk', 'district', 'neighborhood', 'kiez',
    'mitte', 'charlottenburg', 'friedrichshain', 'kreuzberg', 'neukölln',
    'tempelhof', 'schöneberg', 'steglitz', 'zehlendorf', 'wilmersdorf',
    'spandau', 'reinickendorf', 'pankow', 'lichtenberg', 'marzahn',
    'hellersdorf', 'treptow', 'köpenick'
  ];

  processQuery(naturalLanguageQuery: string): DatasetSearchParams {
    const query = naturalLanguageQuery.toLowerCase();

    // Extract main search terms based on keywords found
    const foundKeywords: string[] = [];
    const tags: string[] = [];

    // Find category matches
    for (const [category, keywords] of Object.entries(this.KEYWORDS_MAP)) {
      for (const keyword of keywords) {
        if (query.includes(keyword.toLowerCase())) {
          // Add ALL keywords from this category for comprehensive search
          foundKeywords.push(...keywords);
          tags.push(category);
          break; // Only process category once
        }
      }
    }

    // Extract location information
    for (const location of this.LOCATION_KEYWORDS) {
      if (query.includes(location.toLowerCase())) {
        foundKeywords.push(location);
      }
    }

    // Build search query
    let searchQuery: string;
    if (foundKeywords.length > 0) {
      // Use found keywords for better matching
      searchQuery = foundKeywords.join(' OR ');
    } else {
      // Use original query but clean it up
      const cleanQuery = naturalLanguageQuery
        .replace(/find|search|show me|list|all|datasets?|about|in|for|the/gi, '')
        .trim();
      searchQuery = cleanQuery || naturalLanguageQuery;
    }

    // Build search parameters
    const searchParams: DatasetSearchParams = {
      query: searchQuery,
      limit: 20
    };

    return searchParams;
  }

  extractIntent(query: string): 'search' | 'list' | 'specific' {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('show me')) {
      return 'search';
    }

    if (lowerQuery.includes('list') || lowerQuery.includes('all datasets')) {
      return 'list';
    }

    return 'search'; // Default to search
  }

  generateSummary(results: any[], originalQuery: string): string {
    if (results.length === 0) {
      return `No datasets found for "${originalQuery}". Try refining your search terms.`;
    }

    const categories = new Set<string>();
    const formats = new Set<string>();

    results.forEach(dataset => {
      dataset.tags?.forEach((tag: any) => categories.add(tag.name));
      dataset.resources?.forEach((resource: any) => formats.add(resource.format));
    });

    let summary = `Found ${results.length} dataset(s) related to "${originalQuery}":\n\n`;

    results.slice(0, 5).forEach((dataset, index) => {
      summary += `${index + 1}. **${dataset.title}**\n`;
      summary += `   ${dataset.notes?.substring(0, 100)}${dataset.notes?.length > 100 ? '...' : ''}\n`;
      summary += `   Formats: ${dataset.resources?.map((r: any) => r.format).join(', ') || 'N/A'}\n\n`;
    });

    if (results.length > 5) {
      summary += `... and ${results.length - 5} more datasets.\n\n`;
    }

    summary += `**Categories found:** ${Array.from(categories).slice(0, 10).join(', ')}\n`;
    summary += `**Available formats:** ${Array.from(formats).slice(0, 10).join(', ')}`;

    return summary;
  }
}