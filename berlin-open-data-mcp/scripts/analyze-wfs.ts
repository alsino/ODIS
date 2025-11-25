// ABOUTME: Analyzes WFS resources in Berlin Open Data Portal
// ABOUTME: Fetches WFS datasets and examines URL patterns for implementation planning

import axios from 'axios';

const CKAN_API_BASE = 'https://datenregister.berlin.de/api/3/action';

interface Resource {
  id: string;
  url: string;
  format: string;
  name: string;
  description?: string;
}

interface Dataset {
  id: string;
  name: string;
  title: string;
  resources: Resource[];
}

async function searchWFSDatasets(limit: number = 10): Promise<Dataset[]> {
  const response = await axios.get(`${CKAN_API_BASE}/package_search`, {
    params: {
      q: 'WFS',
      rows: limit,
    },
  });

  return response.data.result.results as Dataset[];
}

async function analyzeWFSResources() {
  console.log('=== Analyzing WFS Resources in Berlin Open Data Portal ===\n');

  const datasets = await searchWFSDatasets(20);
  console.log(`Found ${datasets.length} datasets with WFS in search results\n`);

  const wfsResources: Array<{ dataset: string; resource: Resource }> = [];

  for (const dataset of datasets) {
    for (const resource of dataset.resources) {
      if (resource.format?.toUpperCase() === 'WFS') {
        wfsResources.push({ dataset: dataset.title, resource });
      }
    }
  }

  console.log(`Found ${wfsResources.length} actual WFS resources\n`);
  console.log('=== WFS Resource Examples ===\n');

  // Show first 10 examples
  for (const { dataset, resource } of wfsResources.slice(0, 10)) {
    console.log(`Dataset: ${dataset}`);
    console.log(`Resource Name: ${resource.name}`);
    console.log(`URL: ${resource.url}`);
    console.log(`Description: ${resource.description || 'N/A'}`);
    console.log('---\n');
  }

  // Analyze URL patterns
  console.log('=== URL Pattern Analysis ===\n');
  const urlPatterns = new Map<string, number>();

  for (const { resource } of wfsResources) {
    try {
      const url = new URL(resource.url);
      const basePattern = `${url.protocol}//${url.hostname}${url.pathname}`;
      urlPatterns.set(basePattern, (urlPatterns.get(basePattern) || 0) + 1);
    } catch (e) {
      console.log(`Invalid URL: ${resource.url}`);
    }
  }

  console.log('Base URL patterns (top 10):');
  const sorted = Array.from(urlPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [pattern, count] of sorted) {
    console.log(`${count}x: ${pattern}`);
  }

  // Pick a sample URL to analyze
  if (wfsResources.length > 0) {
    console.log('\n=== Sample WFS URL Analysis ===\n');
    const sample = wfsResources[0].resource;
    console.log(`Sample URL: ${sample.url}\n`);

    try {
      const url = new URL(sample.url);
      console.log('URL Components:');
      console.log(`  Protocol: ${url.protocol}`);
      console.log(`  Host: ${url.hostname}`);
      console.log(`  Path: ${url.pathname}`);
      console.log(`  Query Parameters:`);
      url.searchParams.forEach((value, key) => {
        console.log(`    ${key} = ${value}`);
      });
    } catch (e) {
      console.log('Could not parse URL');
    }
  }
}

analyzeWFSResources().catch(console.error);
