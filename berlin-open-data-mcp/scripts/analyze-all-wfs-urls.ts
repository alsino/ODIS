// ABOUTME: Comprehensive analysis of ALL WFS URLs in Berlin Open Data Portal
// ABOUTME: Identifies different URL patterns and service providers

import axios from 'axios';

const CKAN_API_BASE = 'https://datenregister.berlin.de/api/3/action';

interface Resource {
  id: string;
  url: string;
  format: string;
  name: string;
}

interface Dataset {
  id: string;
  name: string;
  title: string;
  resources: Resource[];
}

async function getAllWFSDatasets(): Promise<Dataset[]> {
  const allDatasets: Dataset[] = [];
  let offset = 0;
  const limit = 100;

  console.log('Fetching ALL datasets from portal...\n');

  while (true) {
    const response = await axios.get(`${CKAN_API_BASE}/package_search`, {
      params: {
        q: 'WFS',
        rows: limit,
        start: offset,
      },
    });

    const results = response.data.result.results as Dataset[];
    allDatasets.push(...results);

    console.log(`  Fetched ${offset + results.length} datasets...`);

    if (results.length < limit) break;
    offset += limit;
  }

  return allDatasets;
}

async function analyzeAllWFSUrls() {
  console.log('=== Comprehensive WFS URL Pattern Analysis ===\n');

  const datasets = await getAllWFSDatasets();
  console.log(`\nTotal datasets with 'WFS' in metadata: ${datasets.length}\n`);

  // Extract all WFS resources
  const wfsResources: Array<{ dataset: string; resource: Resource }> = [];

  for (const dataset of datasets) {
    for (const resource of dataset.resources) {
      if (resource.format?.toUpperCase() === 'WFS') {
        wfsResources.push({ dataset: dataset.title, resource });
      }
    }
  }

  console.log(`Total WFS resources: ${wfsResources.length}\n`);

  // Analyze URL patterns by hostname
  console.log('=== URL Patterns by Hostname ===\n');

  const hostPatterns = new Map<string, Array<string>>();

  for (const { resource } of wfsResources) {
    try {
      const url = new URL(resource.url);
      const host = url.hostname;

      if (!hostPatterns.has(host)) {
        hostPatterns.set(host, []);
      }

      // Store full URL for pattern analysis
      hostPatterns.get(host)!.push(resource.url);
    } catch (e) {
      console.log(`Invalid URL: ${resource.url}`);
    }
  }

  // Show patterns by host
  for (const [host, urls] of hostPatterns.entries()) {
    console.log(`\n${host} (${urls.length} resources):`);
    console.log('─'.repeat(80));

    // Show unique path patterns
    const pathPatterns = new Map<string, number>();

    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        // Extract path pattern (remove specific IDs/names)
        const pattern = `${urlObj.pathname}${urlObj.search ? ' + query params' : ''}`;
        pathPatterns.set(pattern, (pathPatterns.get(pattern) || 0) + 1);
      } catch (e) {
        // skip
      }
    }

    // Show top patterns
    const sortedPatterns = Array.from(pathPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('Top URL patterns:');
    for (const [pattern, count] of sortedPatterns) {
      console.log(`  ${count}x: ${pattern}`);
    }

    // Show 2-3 example URLs
    console.log('\nExample URLs:');
    urls.slice(0, 3).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
  }

  // Detailed analysis of query parameters
  console.log('\n\n=== Query Parameter Analysis ===\n');

  const paramPatterns = new Map<string, number>();

  for (const { resource } of wfsResources) {
    try {
      const url = new URL(resource.url);
      if (url.search) {
        const params = Array.from(url.searchParams.keys()).sort().join(', ');
        paramPatterns.set(params, (paramPatterns.get(params) || 0) + 1);
      } else {
        paramPatterns.set('(no params)', (paramPatterns.get(paramPatterns) || 0) + 1);
      }
    } catch (e) {
      // skip
    }
  }

  const sortedParams = Array.from(paramPatterns.entries())
    .sort((a, b) => b[1] - a[1]);

  console.log('Parameter combinations:');
  for (const [params, count] of sortedParams) {
    console.log(`  ${count}x: ${params}`);
  }

  // Find problematic cases
  console.log('\n\n=== Special Cases to Handle ===\n');

  console.log('1. URLs with pre-existing query parameters:');
  let countWithParams = 0;
  for (const { dataset, resource } of wfsResources) {
    try {
      const url = new URL(resource.url);
      if (url.search && !url.search.includes('GetCapabilities')) {
        console.log(`   ${dataset}`);
        console.log(`   URL: ${resource.url}`);
        countWithParams++;
        if (countWithParams >= 5) break;
      }
    } catch (e) {
      // skip
    }
  }

  console.log('\n2. URLs already containing GetCapabilities:');
  let countGetCap = 0;
  for (const { dataset, resource } of wfsResources) {
    if (resource.url.includes('GetCapabilities')) {
      console.log(`   ${dataset}`);
      console.log(`   URL: ${resource.url}`);
      countGetCap++;
      if (countGetCap >= 5) break;
    }
  }

  console.log('\n3. Non-standard paths (not /services/wfs/):');
  let countNonStandard = 0;
  for (const { dataset, resource } of wfsResources) {
    if (!resource.url.includes('/services/wfs/') && !resource.url.includes('GetCapabilities')) {
      console.log(`   ${dataset}`);
      console.log(`   URL: ${resource.url}`);
      countNonStandard++;
      if (countNonStandard >= 5) break;
    }
  }
}

analyzeAllWFSUrls().catch(console.error);
