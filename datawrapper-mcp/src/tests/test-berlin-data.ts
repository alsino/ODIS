// ABOUTME: Test script using real Berlin Open Data for chart creation
// ABOUTME: Run with: npm run build && node dist/tests/test-berlin-data.js

import * as dotenv from 'dotenv';
import axios from 'axios';
import { DatawrapperClient } from '../datawrapper-client.js';
import { ChartBuilder } from '../chart-builder.js';

dotenv.config();

const API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;
if (!API_TOKEN) {
  console.error('DATAWRAPPER_API_TOKEN required');
  process.exit(1);
}

const client = new DatawrapperClient(API_TOKEN);
const builder = new ChartBuilder();

// Berlin CKAN API
const CKAN_API = 'https://datenregister.berlin.de/api/3/action';

interface DatasetInfo {
  name: string;
  title: string;
  url: string;
  resourceUrl: string;
}

interface TestResult {
  name: string;
  chartType: string;
  success: boolean;
  url?: string;
  error?: string;
  datasetUrl?: string;
}

/**
 * Get dataset info from CKAN API
 */
async function getDatasetInfo(datasetId: string): Promise<DatasetInfo | null> {
  try {
    const response = await axios.get(`${CKAN_API}/package_show`, {
      params: { id: datasetId },
    });
    const result = response.data.result;
    const csvResource = result.resources.find((r: any) => r.format === 'CSV');

    return {
      name: result.name,
      title: result.title,
      url: `https://daten.berlin.de/datensaetze/${result.name}`,
      resourceUrl: csvResource?.url || '',
    };
  } catch (error) {
    console.error(`Failed to get dataset info for ${datasetId}`);
    return null;
  }
}

/**
 * Fetch CSV data from a URL
 */
async function fetchCsvData(
  url: string,
  delimiter: string = ',',
  maxRows: number = 100
): Promise<Array<Record<string, any>>> {
  const response = await axios.get(url);
  const lines = response.data.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(delimiter).map((h: string) => h.trim().replace(/"/g, ''));
  const data: Array<Record<string, any>> = [];

  for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
    const values = lines[i].split(delimiter).map((v: string) => {
      const cleaned = v.trim().replace(/"/g, '');
      // Handle German number format (comma as decimal separator)
      const num = parseFloat(cleaned.replace(',', '.'));
      return isNaN(num) ? cleaned : num;
    });

    const row: Record<string, any> = {};
    headers.forEach((h: string, idx: number) => {
      row[h] = values[idx];
    });
    data.push(row);
  }

  return data;
}

/**
 * Create a chart with the datawrapper client
 */
async function createChart(
  name: string,
  chartType: string,
  data: Array<Record<string, any>>,
  variant?: string,
  visualize?: Record<string, any>,
  sourceUrl?: string
): Promise<{ url: string }> {
  const dwType = builder.getDatawrapperType(chartType as any, variant as any);

  const metadata: Record<string, any> = {
    title: name,
  };

  // Add source URL
  if (sourceUrl) {
    metadata.describe = {
      'source-name': 'Berlin Open Data',
      'source-url': sourceUrl,
    };
  }

  if (visualize) {
    metadata.visualize = visualize;
  }

  // Add default settings for certain chart types
  if (['range', 'arrow'].includes(chartType)) {
    metadata.visualize = {
      ...metadata.visualize,
      'show-value-labels': true,
      'range-value-labels': 'both',
      'label-first-range': true,
      'show-color-key': true,
    };
  } else if (chartType === 'dot') {
    metadata.visualize = {
      ...metadata.visualize,
      'show-value-labels': true,
      'range-value-labels': 'both',
      'label-first-range': true,
      'show-color-key': true,
    };
  } else if (chartType === 'scatter') {
    // Scatter plots need axes.labels for data point labels
    const cols = builder.analyzeColumns(data);
    if (cols.categorical.length > 0 && cols.numeric.length >= 2) {
      metadata.axes = {
        x: cols.numeric[0],
        y: cols.numeric[1],
        labels: cols.categorical[0],
      };
    }
  }

  const chart = await client.createChart(dwType, metadata);
  const dataString = builder.formatForDatawrapper(data);
  await client.uploadData(chart.id, dataString);
  const published = await client.publishChart(chart.id);

  return { url: client.getPublicUrl(published.publicId || chart.id) };
}

// ============================================================
// Test Cases with Real Berlin Data
// ============================================================

/**
 * Test 1: Baby Names - Bar Chart
 * Dataset: Liste der häufigen Vornamen 2023
 */
async function testBabyNamesBar(): Promise<TestResult> {
  const name = 'Top 10 Baby Names in Berlin Mitte 2023 (Bar)';
  const datasetId = 'liste-der-h-ufigen-vornamen-2023';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://github.com/berlin/haeufige-vornamen-berlin/raw/main/data/2023/mitte.csv';

    const rawData = await fetchCsvData(csvUrl);

    // Aggregate by name, take top 10
    const nameCount: Record<string, number> = {};
    for (const row of rawData) {
      const vorname = row.vorname as string;
      const anzahl = row.anzahl as number;
      nameCount[vorname] = (nameCount[vorname] || 0) + anzahl;
    }

    const data = Object.entries(nameCount)
      .map(([Vorname, Anzahl]) => ({ Vorname, Anzahl }))
      .sort((a, b) => b.Anzahl - a.Anzahl)
      .slice(0, 10);

    const result = await createChart(name, 'bar', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'bar', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'bar', success: false, error: error.message };
  }
}

/**
 * Test 2: Baby Names by Gender - Stacked Column
 * Dataset: Liste der häufigen Vornamen 2023
 */
async function testBabyNamesGenderColumn(): Promise<TestResult> {
  const name = 'Baby Names by Gender - Berlin Districts 2023 (Stacked Column)';
  const datasetId = 'liste-der-h-ufigen-vornamen-2023';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const districts = ['mitte', 'pankow', 'neukoelln', 'friedrichshain-kreuzberg'];

    const data: Array<Record<string, any>> = [];

    for (const district of districts) {
      const csvUrl = `https://github.com/berlin/haeufige-vornamen-berlin/raw/main/data/2023/${district}.csv`;
      const rawData = await fetchCsvData(csvUrl, ',', 500);

      let male = 0, female = 0;
      for (const row of rawData) {
        const anzahl = row.anzahl as number || 0;
        if (row.geschlecht === 'm') male += anzahl;
        if (row.geschlecht === 'w') female += anzahl;
      }

      const districtName = district.charAt(0).toUpperCase() + district.slice(1).replace(/-/g, '-');
      data.push({ Bezirk: districtName, Jungen: male, Mädchen: female });
    }

    const result = await createChart(name, 'column', data, 'stacked', undefined, datasetInfo?.url);
    return { name, chartType: 'column (stacked)', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'column (stacked)', success: false, error: error.message };
  }
}

/**
 * Test 3: School Broadband Status - Pie Chart
 * Dataset: Breitband-Ausbau der Berliner Schulen
 */
async function testSchoolBroadbandPie(): Promise<TestResult> {
  const name = 'Berlin School Broadband Status (Pie)';
  const datasetId = 'breitband-ausbau-der-berliner-schulen-1430033';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://www.berlin.de/sen/bildung/service/daten/breitbandausbau-nov-2025.csv';

    const rawData = await fetchCsvData(csvUrl, ';', 1000);

    // Count by status
    const statusCount: Record<string, number> = {};
    for (const row of rawData) {
      const status = row['aktueller status'] as string || 'Unbekannt';
      statusCount[status] = (statusCount[status] || 0) + 1;
    }

    const data = Object.entries(statusCount)
      .map(([Status, Anzahl]) => ({ Status, Anzahl }))
      .sort((a, b) => b.Anzahl - a.Anzahl);

    const result = await createChart(name, 'pie', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'pie', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'pie', success: false, error: error.message };
  }
}

/**
 * Test 4: School Types by District - Grouped Column
 * Dataset: Breitband-Ausbau der Berliner Schulen
 */
async function testSchoolTypesColumn(): Promise<TestResult> {
  const name = 'School Types by District (Grouped Column)';
  const datasetId = 'breitband-ausbau-der-berliner-schulen-1430033';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://www.berlin.de/sen/bildung/service/daten/breitbandausbau-nov-2025.csv';

    const rawData = await fetchCsvData(csvUrl, ';', 1000);

    // Count school types by district (top 4 districts only)
    const districtTypes: Record<string, Record<string, number>> = {};
    for (const row of rawData) {
      const bezirk = row['bezirk'] as string;
      const schulart = row['schulart'] as string;
      if (!bezirk || !schulart) continue;

      if (!districtTypes[bezirk]) districtTypes[bezirk] = {};
      districtTypes[bezirk][schulart] = (districtTypes[bezirk][schulart] || 0) + 1;
    }

    // Get top 4 districts by total schools
    const districtTotals = Object.entries(districtTypes)
      .map(([d, types]) => ({ district: d, total: Object.values(types).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    // Build data for grouped column (Grundschule vs Gymnasium)
    const data = districtTotals.map(({ district }) => ({
      Bezirk: district,
      Grundschule: districtTypes[district]['G'] || 0,
      Gymnasium: districtTypes[district]['Y'] || 0,
      Sekundarschule: districtTypes[district]['K'] || 0,
    }));

    const result = await createChart(name, 'column', data, 'grouped', undefined, datasetInfo?.url);
    return { name, chartType: 'column (grouped)', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'column (grouped)', success: false, error: error.message };
  }
}

/**
 * Test 5: Bicycle Theft by Type - Donut Chart
 * Dataset: Fahrraddiebstahl in Berlin
 */
async function testBicycleTheftDonut(): Promise<TestResult> {
  const name = 'Bicycle Theft by Type - Berlin (Donut)';
  const datasetId = 'fahrraddiebstahl-in-berlin';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://www.polizei-berlin.eu/Fahrraddiebstahl/Fahrraddiebstahl.csv';

    const rawData = await fetchCsvData(csvUrl, ',', 5000);

    // Count by bicycle type
    const typeCount: Record<string, number> = {};
    for (const row of rawData) {
      const type = row['ART_DES_FAHRRADS'] as string || 'Unbekannt';
      typeCount[type] = (typeCount[type] || 0) + 1;
    }

    const data = Object.entries(typeCount)
      .map(([Fahrradtyp, Anzahl]) => ({ Fahrradtyp, Anzahl }))
      .sort((a, b) => b.Anzahl - a.Anzahl);

    const result = await createChart(name, 'donut', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'donut', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'donut', success: false, error: error.message };
  }
}

/**
 * Test 6: Bicycle Theft Damage Range - Range Plot
 * Dataset: Fahrraddiebstahl in Berlin
 */
async function testBicycleTheftRange(): Promise<TestResult> {
  const name = 'Bicycle Theft Damage Range by Type (Range)';
  const datasetId = 'fahrraddiebstahl-in-berlin';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://www.polizei-berlin.eu/Fahrraddiebstahl/Fahrraddiebstahl.csv';

    const rawData = await fetchCsvData(csvUrl, ',', 5000);

    // Calculate min/max damage by bicycle type
    const typeStats: Record<string, { min: number; max: number; count: number }> = {};
    for (const row of rawData) {
      const type = row['ART_DES_FAHRRADS'] as string;
      const damage = row['SCHADENSHOEHE'] as number;
      if (!type || !damage || damage <= 0) continue;

      if (!typeStats[type]) {
        typeStats[type] = { min: damage, max: damage, count: 0 };
      }
      typeStats[type].min = Math.min(typeStats[type].min, damage);
      typeStats[type].max = Math.max(typeStats[type].max, damage);
      typeStats[type].count++;
    }

    // Take types with at least 100 records
    const data = Object.entries(typeStats)
      .filter(([_, stats]) => stats.count >= 100)
      .map(([Fahrradtyp, stats]) => ({
        Fahrradtyp,
        'Min Schaden €': Math.round(stats.min),
        'Max Schaden €': Math.round(stats.max),
      }))
      .sort((a, b) => b['Max Schaden €'] - a['Max Schaden €']);

    const result = await createChart(name, 'range', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'range', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'range', success: false, error: error.message };
  }
}

/**
 * Test 7: Baby Names Trend - Line Chart
 * Dataset: Liste der häufigen Vornamen (multiple years)
 */
async function testBabyNamesTrendLine(): Promise<TestResult> {
  const name = 'Top Name "Emma" Trend in Berlin Mitte (Line)';
  const datasetId = 'liste-der-h-ufigen-vornamen-2023';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const years = ['2019', '2020', '2021', '2022', '2023'];

    const data: Array<Record<string, any>> = [];

    for (const year of years) {
      const csvUrl = `https://github.com/berlin/haeufige-vornamen-berlin/raw/main/data/${year}/mitte.csv`;
      try {
        const rawData = await fetchCsvData(csvUrl, ',', 500);

        // Find "Emma" count
        let emmaCount = 0;
        for (const row of rawData) {
          if ((row.vorname as string)?.toLowerCase() === 'emma') {
            emmaCount += row.anzahl as number || 0;
          }
        }

        data.push({ Jahr: year, Anzahl: emmaCount });
      } catch {
        // Skip year if data not available
      }
    }

    const result = await createChart(name, 'line', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'line', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'line', success: false, error: error.message };
  }
}

/**
 * Test 8: Schools Data Table
 * Dataset: Breitband-Ausbau der Berliner Schulen
 */
async function testSchoolsTable(): Promise<TestResult> {
  const name = 'Berlin Schools Overview (Table)';
  const datasetId = 'breitband-ausbau-der-berliner-schulen-1430033';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://www.berlin.de/sen/bildung/service/daten/breitbandausbau-nov-2025.csv';

    const rawData = await fetchCsvData(csvUrl, ';', 20);

    // Select relevant columns
    const data = rawData.slice(0, 10).map(row => ({
      Schulnummer: row['schulnummer'],
      Bezirk: row['bezirk'],
      Schule: row['schule'],
      Status: row['aktueller status'],
    }));

    const result = await createChart(name, 'table', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'table', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'table', success: false, error: error.message };
  }
}

/**
 * Test 9: Baby Names Gender Comparison - Dot Plot
 * Dataset: Liste der häufigen Vornamen 2023
 */
async function testBabyNamesGenderDot(): Promise<TestResult> {
  const name = 'Baby Names Count by District & Gender (Dot Plot)';
  const datasetId = 'liste-der-h-ufigen-vornamen-2023';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const districts = ['mitte', 'pankow', 'neukoelln'];

    const data: Array<Record<string, any>> = [];

    for (const district of districts) {
      const csvUrl = `https://github.com/berlin/haeufige-vornamen-berlin/raw/main/data/2023/${district}.csv`;
      const rawData = await fetchCsvData(csvUrl, ',', 500);

      let male = 0, female = 0;
      for (const row of rawData) {
        const anzahl = row.anzahl as number || 0;
        if (row.geschlecht === 'm') male += anzahl;
        if (row.geschlecht === 'w') female += anzahl;
      }

      const districtName = district.charAt(0).toUpperCase() + district.slice(1);
      data.push({ Bezirk: districtName, Jungen: male, Mädchen: female });
    }

    const result = await createChart(name, 'dot', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'dot', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'dot', success: false, error: error.message };
  }
}

/**
 * Test 10: Bicycle Theft Scatter - damage vs time
 * Dataset: Fahrraddiebstahl in Berlin
 */
async function testBicycleTheftScatter(): Promise<TestResult> {
  const name = 'Bicycle Theft: Hour vs Damage (Scatter)';
  const datasetId = 'fahrraddiebstahl-in-berlin';

  try {
    const datasetInfo = await getDatasetInfo(datasetId);
    const csvUrl = 'https://www.polizei-berlin.eu/Fahrraddiebstahl/Fahrraddiebstahl.csv';

    const rawData = await fetchCsvData(csvUrl, ',', 500);

    // Aggregate by hour (average damage)
    const hourlyDamage: Record<number, { total: number; count: number }> = {};
    for (const row of rawData) {
      const hour = row['TATZEIT_ANFANG_STUNDE'] as number;
      const damage = row['SCHADENSHOEHE'] as number;
      if (hour === undefined || !damage || damage <= 0) continue;

      if (!hourlyDamage[hour]) {
        hourlyDamage[hour] = { total: 0, count: 0 };
      }
      hourlyDamage[hour].total += damage;
      hourlyDamage[hour].count++;
    }

    const data = Object.entries(hourlyDamage)
      .map(([hour, stats]) => ({
        Uhrzeit: `${hour}:00`,
        Stunde: parseInt(hour),
        'Durchschn. Schaden €': Math.round(stats.total / stats.count),
      }))
      .sort((a, b) => a.Stunde - b.Stunde);

    const result = await createChart(name, 'scatter', data, undefined, undefined, datasetInfo?.url);
    return { name, chartType: 'scatter', success: true, url: result.url, datasetUrl: datasetInfo?.url };
  } catch (error: any) {
    return { name, chartType: 'scatter', success: false, error: error.message };
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('Testing chart types with REAL Berlin Open Data\n');
  console.log('='.repeat(70));

  const tests = [
    testBabyNamesBar,
    testBabyNamesGenderColumn,
    testSchoolBroadbandPie,
    testSchoolTypesColumn,
    testBicycleTheftDonut,
    testBicycleTheftRange,
    testBabyNamesTrendLine,
    testSchoolsTable,
    testBabyNamesGenderDot,
    testBicycleTheftScatter,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await test();
    results.push(result);

    if (result.success) {
      console.log(`\n✅ ${result.name}`);
      console.log(`   Chart: ${result.url}`);
      if (result.datasetUrl) {
        console.log(`   Data:  ${result.datasetUrl}`);
      }
    } else {
      console.log(`\n❌ ${result.name}`);
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  const passed = results.filter((r) => r.success).length;
  console.log(`\nSummary: ${passed}/${results.length} tests passed`);

  if (passed === results.length) {
    console.log('\n📊 All Berlin data visualizations created successfully!');
  }

  console.log('\nAll chart URLs:');
  results
    .filter((r) => r.success)
    .forEach((r) => console.log(`  ${r.chartType.padEnd(20)} ${r.url}`));
}

main().catch(console.error);
