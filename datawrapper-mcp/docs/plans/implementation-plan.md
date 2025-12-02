# Datawrapper MCP Server - Implementation Plan

## Overview

This document provides a detailed, step-by-step implementation guide for building the Datawrapper MCP server. Follow the phases sequentially to build from basic infrastructure to full integration.

---

## Prerequisites

### Required Tools
- Node.js v18+ and npm
- TypeScript 5.3+
- Datawrapper account with API access
- Git for version control

### Required Knowledge
- TypeScript/Node.js development
- MCP protocol basics (refer to berlin-open-data-mcp as reference)
- REST API integration
- Async/await patterns

### Setup Checklist
- [ ] Datawrapper account created
- [ ] API token generated with permissions: `chart:read`, `chart:write`, `chart:publish`
- [ ] Development environment ready

---

## Phase 1: Project Setup & Core Infrastructure

**Goal**: Set up project structure, dependencies, and basic MCP server scaffold.

**Duration**: 1 day

### Task 1.1: Initialize Project

**Create project structure**:
```bash
cd /Users/alsino/Desktop/ODIS/datawrapper-mcp
mkdir -p src tests/unit tests/integration tests/e2e

# Initialize npm project
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk axios dotenv
npm install --save-dev typescript @types/node @types/axios tsx

# Initialize TypeScript
npx tsc --init
```

**Configure `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Update `package.json`**:
```json
{
  "name": "datawrapper-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "bin": {
    "datawrapper-mcp": "./dist/index.js"
  }
}
```

**Create `.env.example`**:
```bash
# Datawrapper API Configuration
DATAWRAPPER_API_TOKEN=your_token_here

# Optional Configuration
CHART_LOG_PATH=./charts-log.json
```

**Create `.gitignore`**:
```
node_modules/
dist/
.env
*.log
charts-log.json
.DS_Store
```

---

### Task 1.2: Define TypeScript Interfaces

**Create `src/types.ts`**:
```typescript
// ABOUTME: TypeScript type definitions for Datawrapper MCP server
// ABOUTME: Defines interfaces for charts, data, API responses, and MCP tools

export type ChartType = 'bar' | 'line' | 'map';

export interface ChartData {
  data: Array<Record<string, any>> | GeoJSONFeatureCollection;
  chart_type: ChartType;
  title?: string;
  description?: string;
  source_dataset_id?: string;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
    coordinates: any;
  };
  properties?: Record<string, any>;
}

export interface ChartConfig {
  type: string; // Datawrapper chart type
  title: string;
  metadata: {
    describe?: {
      byline?: string;
      'source-name'?: string;
      'source-url'?: string;
    };
    visualize?: Record<string, any>;
  };
}

export interface ChartLogEntry {
  chartId: string;
  url: string;
  embedCode: string;
  editUrl: string;
  chartType: ChartType;
  title: string;
  createdAt: string;
  sourceDatasetId?: string;
  sourceDatasetUrl?: string;
  dataRowCount: number;
}

export interface DatawrapperChart {
  id: string;
  title: string;
  type: string;
  publicUrl: string;
  publicId: string;
}

export interface DatawrapperPublishResponse {
  url: string;
  publicId: string;
}
```

---

### Task 1.3: Create MCP Server Scaffold

**Create `src/index.ts`**:
```typescript
#!/usr/bin/env node
// ABOUTME: MCP server entry point for Datawrapper integration
// ABOUTME: Exposes create_visualization tool for chart generation

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class DatawrapperMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'datawrapper-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_visualization',
          description: 'Create a data visualization using Datawrapper API. Supports bar charts, line charts, and maps (GeoJSON).',
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                description: 'Array of data objects to visualize. For maps, provide GeoJSON FeatureCollection.',
                items: { type: 'object' },
              },
              chart_type: {
                type: 'string',
                enum: ['bar', 'line', 'map'],
                description: 'Type of visualization: "bar", "line", or "map"',
              },
              title: {
                type: 'string',
                description: 'Optional: Chart title (auto-generated if not provided)',
              },
              description: {
                type: 'string',
                description: 'Optional: Chart description or byline',
              },
              source_dataset_id: {
                type: 'string',
                description: 'Optional: Berlin dataset ID for tracking provenance',
              },
            },
            required: ['data', 'chart_type'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'create_visualization') {
        return await this.handleCreateVisualization(request.params.arguments);
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  private async handleCreateVisualization(args: any) {
    // TODO: Implement in Phase 2
    return {
      content: [
        {
          type: 'text',
          text: '✅ Datawrapper MCP server is running! Chart creation not yet implemented.',
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Datawrapper MCP Server running on stdio');
  }
}

const server = new DatawrapperMCPServer();
server.run().catch(console.error);
```

---

### Task 1.4: Test Basic Server

**Build and test**:
```bash
npm run build

# Test with MCP inspector (if available) or manual stdio test
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

**Expected output**: Server starts without errors, responds to `tools/list` request.

**Commit**:
```bash
git add .
git commit -m "Initialize Datawrapper MCP server project

- Set up TypeScript configuration
- Define core types and interfaces
- Create MCP server scaffold with create_visualization tool
- Add environment configuration template
"
```

---

## Phase 2: Datawrapper API Client

**Goal**: Implement wrapper around Datawrapper API for chart creation, data upload, and publishing.

**Duration**: 1-2 days

### Task 2.1: Create Datawrapper Client

**Create `src/datawrapper-client.ts`**:
```typescript
// ABOUTME: Datawrapper API v3 client wrapper
// ABOUTME: Handles authentication, chart creation, data upload, and publishing

import axios, { AxiosInstance } from 'axios';
import type { ChartConfig, DatawrapperChart, DatawrapperPublishResponse } from './types.js';

export class DatawrapperClient {
  private api: AxiosInstance;
  private apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.DATAWRAPPER_API_TOKEN || '';

    if (!this.apiToken) {
      throw new Error('DATAWRAPPER_API_TOKEN environment variable is required');
    }

    this.api = axios.create({
      baseURL: 'https://api.datawrapper.de/v3',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new empty chart
   */
  async createChart(config: ChartConfig): Promise<DatawrapperChart> {
    try {
      const response = await this.api.post('/charts', {
        type: config.type,
        title: config.title,
        metadata: config.metadata,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Datawrapper authentication failed. Please check your API token.');
        }
        throw new Error(`Failed to create chart: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Upload data to a chart
   */
  async uploadData(chartId: string, data: string, format: 'csv' | 'json' = 'csv'): Promise<void> {
    try {
      await this.api.put(`/charts/${chartId}/data`, data, {
        headers: {
          'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to upload data: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update chart metadata
   */
  async updateChart(chartId: string, updates: Partial<ChartConfig>): Promise<DatawrapperChart> {
    try {
      const response = await this.api.patch(`/charts/${chartId}`, updates);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to update chart: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Publish a chart (makes it publicly accessible)
   */
  async publishChart(chartId: string): Promise<DatawrapperPublishResponse> {
    try {
      const response = await this.api.post(`/charts/${chartId}/publish`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to publish chart: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get chart information including URLs
   */
  async getChartInfo(chartId: string): Promise<DatawrapperChart> {
    try {
      const response = await this.api.get(`/charts/${chartId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get chart info: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get embed code for a chart
   */
  getEmbedCode(publicId: string, width: number = 600, height: number = 400): string {
    return `<iframe title="Chart" aria-label="Chart" id="datawrapper-chart-${publicId}" src="https://datawrapper.dwcdn.net/${publicId}/" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="${height}" data-external="1"></iframe><script type="text/javascript">!function(){"use strict";window.addEventListener("message",(function(a){if(void 0!==a.data["datawrapper-height"]){var e=document.querySelectorAll("iframe");for(var t in a.data["datawrapper-height"])for(var r=0;r<e.length;r++)if(e[r].contentWindow===a.source){var i=a.data["datawrapper-height"][t]+"px";e[r].style.height=i}}}))}();</script>`;
  }
}
```

---

### Task 2.2: Test API Client

**Create `tests/integration/datawrapper-client.test.ts`** (manual test):
```typescript
import { DatawrapperClient } from '../../src/datawrapper-client.js';

async function testDatawrapperClient() {
  const client = new DatawrapperClient();

  console.log('Creating test chart...');
  const chart = await client.createChart({
    type: 'd3-bars',
    title: 'Test Chart',
    metadata: {},
  });

  console.log('Chart created:', chart.id);

  console.log('Uploading data...');
  const csvData = 'Category,Value\nA,10\nB,20\nC,15';
  await client.uploadData(chart.id, csvData, 'csv');

  console.log('Publishing chart...');
  const published = await client.publishChart(chart.id);

  console.log('Chart URL:', published.url);
  console.log('Embed code:', client.getEmbedCode(published.publicId));

  console.log('✅ All tests passed!');
}

testDatawrapperClient().catch(console.error);
```

**Run test**:
```bash
# Set API token in .env first
npx tsx tests/integration/datawrapper-client.test.ts
```

**Verify**: Chart is created and published on Datawrapper, URLs are valid.

**Commit**:
```bash
git add src/datawrapper-client.ts tests/integration/
git commit -m "Add Datawrapper API client

- Implement chart creation, data upload, and publishing
- Add error handling for authentication and API failures
- Include embed code generation
- Add integration test for API client
"
```

---

## Phase 3: Chart Builder & Smart Defaults

**Goal**: Implement smart defaults logic for inferring chart configuration from data.

**Duration**: 2 days

### Task 3.1: Utility Functions

**Create `src/utils.ts`**:
```typescript
// ABOUTME: Utility functions for data processing and formatting
// ABOUTME: Includes column detection, label formatting, and data conversion

/**
 * Detect column types in data
 */
export function detectColumnTypes(data: Array<Record<string, any>>): Record<string, 'string' | 'number' | 'date'> {
  if (data.length === 0) return {};

  const types: Record<string, 'string' | 'number' | 'date'> = {};
  const sampleRow = data[0];

  for (const [key, value] of Object.entries(sampleRow)) {
    if (typeof value === 'number') {
      types[key] = 'number';
    } else if (typeof value === 'string' && !isNaN(Date.parse(value))) {
      types[key] = 'date';
    } else {
      types[key] = 'string';
    }
  }

  return types;
}

/**
 * Format label (capitalize, replace underscores)
 */
export function formatLabel(text: string): string {
  return text
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert array of objects to CSV
 */
export function arrayToCSV(data: Array<Record<string, any>>): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape CSV values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Validate GeoJSON structure
 */
export function isValidGeoJSON(data: any): boolean {
  return (
    data &&
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features) &&
    data.features.length > 0 &&
    data.features.every((f: any) => f.type === 'Feature' && f.geometry)
  );
}
```

---

### Task 3.2: Chart Builder for Bar & Line Charts

**Create `src/chart-builder.ts`**:
```typescript
// ABOUTME: Smart defaults engine for chart configuration
// ABOUTME: Infers titles, axes, and optimal settings from data structure

import type { ChartType, ChartConfig, ChartData } from './types.js';
import { detectColumnTypes, formatLabel, arrayToCSV, isValidGeoJSON } from './utils.js';

export class ChartBuilder {
  /**
   * Generate complete chart configuration with smart defaults
   */
  inferChartConfig(chartData: ChartData): ChartConfig {
    const { data, chart_type, title, description, source_dataset_id } = chartData;

    // Validate data
    this.validateData(data, chart_type);

    // Generate title
    const chartTitle = title || this.generateTitle(data, chart_type, source_dataset_id);

    // Build config based on chart type
    switch (chart_type) {
      case 'bar':
        return this.buildBarChartConfig(data as Array<Record<string, any>>, chartTitle, description);
      case 'line':
        return this.buildLineChartConfig(data as Array<Record<string, any>>, chartTitle, description);
      case 'map':
        return this.buildMapConfig(data, chartTitle, description);
      default:
        throw new Error(`Unsupported chart type: ${chart_type}`);
    }
  }

  /**
   * Validate input data
   */
  private validateData(data: any, chartType: ChartType): void {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('Cannot create visualization: Data array is empty.');
    }

    if (Array.isArray(data) && data.length > 10000) {
      throw new Error(`Data exceeds Datawrapper limit of 10,000 rows (provided: ${data.length}).`);
    }

    if (chartType === 'map' && !isValidGeoJSON(data)) {
      throw new Error('Invalid GeoJSON: Maps require GeoJSON FeatureCollection format.');
    }

    if ((chartType === 'bar' || chartType === 'line') && !Array.isArray(data)) {
      throw new Error(`${chartType} charts require array of objects.`);
    }

    // Check for numeric columns in bar/line charts
    if ((chartType === 'bar' || chartType === 'line') && Array.isArray(data)) {
      const types = detectColumnTypes(data as Array<Record<string, any>>);
      const hasNumeric = Object.values(types).some(t => t === 'number');
      if (!hasNumeric) {
        throw new Error(`Cannot create ${chartType} chart: No numeric columns found in data.`);
      }
    }
  }

  /**
   * Generate chart title
   */
  private generateTitle(data: any, chartType: ChartType, sourceDatasetId?: string): string {
    // TODO: In future, query CKAN API for dataset title if sourceDatasetId provided

    if (Array.isArray(data) && data.length > 0) {
      const firstColumn = Object.keys(data[0])[0];
      return `${formatLabel(firstColumn)} Overview`;
    }

    return 'Data Visualization';
  }

  /**
   * Build bar chart configuration
   */
  private buildBarChartConfig(
    data: Array<Record<string, any>>,
    title: string,
    description?: string
  ): ChartConfig {
    const types = detectColumnTypes(data);
    const columns = Object.keys(data[0]);

    // Find categorical column (X-axis)
    const categoricalCol = columns.find(col => types[col] === 'string') || columns[0];

    // Find numeric columns (Y-axis)
    const numericCols = columns.filter(col => types[col] === 'number');

    if (numericCols.length === 0) {
      throw new Error('Bar chart requires at least one numeric column');
    }

    return {
      type: 'd3-bars',
      title,
      metadata: {
        describe: {
          byline: description,
        },
        visualize: {
          'x-axis-label': formatLabel(categoricalCol),
          'y-axis-label': numericCols.length === 1 ? formatLabel(numericCols[0]) : 'Value',
        },
      },
    };
  }

  /**
   * Build line chart configuration
   */
  private buildLineChartConfig(
    data: Array<Record<string, any>>,
    title: string,
    description?: string
  ): ChartConfig {
    const types = detectColumnTypes(data);
    const columns = Object.keys(data[0]);

    // Find date/string column for X-axis
    const xCol = columns.find(col => types[col] === 'date' || types[col] === 'string') || columns[0];

    // Find numeric columns for Y-axis
    const numericCols = columns.filter(col => types[col] === 'number');

    if (numericCols.length === 0) {
      throw new Error('Line chart requires at least one numeric column');
    }

    return {
      type: 'd3-lines',
      title,
      metadata: {
        describe: {
          byline: description,
        },
        visualize: {
          'x-axis-label': formatLabel(xCol),
          'y-axis-label': numericCols.length === 1 ? formatLabel(numericCols[0]) : 'Value',
        },
      },
    };
  }

  /**
   * Build map configuration (placeholder for now)
   */
  private buildMapConfig(data: any, title: string, description?: string): ChartConfig {
    // TODO: Implement in Task 3.3
    return {
      type: 'd3-maps-choropleth',
      title,
      metadata: {
        describe: {
          byline: description,
        },
        visualize: {
          // Berlin bounds
          'map-bounds': {
            west: 13.0882,
            south: 52.3382,
            east: 13.7611,
            north: 52.6755,
          },
        },
      },
    };
  }

  /**
   * Format data for Datawrapper upload
   */
  formatDataForUpload(data: any, chartType: ChartType): string {
    if (chartType === 'map') {
      return JSON.stringify(data);
    }

    // Bar and line charts use CSV
    return arrayToCSV(data as Array<Record<string, any>>);
  }
}
```

---

### Task 3.3: Add Map Support

**Update `buildMapConfig` in `src/chart-builder.ts`**:
```typescript
/**
 * Build map configuration for GeoJSON data
 */
private buildMapConfig(data: any, title: string, description?: string): ChartConfig {
  // Detect if points or polygons
  const firstFeature = data.features[0];
  const geometryType = firstFeature.geometry.type;

  let mapType = 'd3-maps-symbols'; // For points
  if (geometryType.includes('Polygon')) {
    mapType = 'd3-maps-choropleth'; // For polygons
  }

  // Check if numeric property exists for choropleth
  const properties = firstFeature.properties || {};
  const numericProp = Object.keys(properties).find(key => typeof properties[key] === 'number');

  return {
    type: mapType,
    title,
    metadata: {
      describe: {
        byline: description,
      },
      visualize: {
        'map-bounds': {
          west: 13.0882,
          south: 52.3382,
          east: 13.7611,
          north: 52.6755,
        },
        ...(numericProp && {
          'map-key-attr': numericProp, // Use numeric property for choropleth color scale
        }),
      },
    },
  };
}
```

**Commit**:
```bash
git add src/chart-builder.ts src/utils.ts
git commit -m "Add chart builder with smart defaults

- Implement column type detection and axis inference
- Add bar and line chart configuration builders
- Add map configuration for GeoJSON data
- Include data validation and error messages
- Add utility functions for CSV conversion and label formatting
"
```

---

## Phase 4: Chart Logger

**Goal**: Implement JSON logging for created charts with provenance tracking.

**Duration**: 0.5 days

### Task 4.1: Create Chart Logger

**Create `src/chart-logger.ts`**:
```typescript
// ABOUTME: Chart logging for provenance tracking
// ABOUTME: Maintains append-only JSON log of created charts

import fs from 'fs/promises';
import type { ChartLogEntry } from './types.js';

export class ChartLogger {
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath || process.env.CHART_LOG_PATH || './charts-log.json';
  }

  /**
   * Log a newly created chart
   */
  async logChart(entry: ChartLogEntry): Promise<void> {
    try {
      // Read existing log
      let entries: ChartLogEntry[] = [];
      try {
        const content = await fs.readFile(this.logPath, 'utf-8');
        entries = JSON.parse(content);
      } catch (error) {
        // File doesn't exist yet, start fresh
        entries = [];
      }

      // Append new entry
      entries.push(entry);

      // Write back
      await fs.writeFile(this.logPath, JSON.stringify(entries, null, 2), 'utf-8');

      console.error(`[ChartLogger] Logged chart ${entry.chartId} to ${this.logPath}`);
    } catch (error) {
      console.error('[ChartLogger] Failed to log chart:', error);
      // Don't throw - logging failure shouldn't stop chart creation
    }
  }

  /**
   * Get all logged charts
   */
  async getCharts(): Promise<ChartLogEntry[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Find charts by source dataset ID
   */
  async findByDataset(datasetId: string): Promise<ChartLogEntry[]> {
    const charts = await this.getCharts();
    return charts.filter(c => c.sourceDatasetId === datasetId);
  }
}
```

**Commit**:
```bash
git add src/chart-logger.ts
git commit -m "Add chart logger for provenance tracking

- Implement append-only JSON log
- Support querying charts by source dataset
- Include error handling to prevent logging failures from blocking chart creation
"
```

---

## Phase 5: Integration & Main Tool Implementation

**Goal**: Wire everything together and implement the `create_visualization` tool.

**Duration**: 1 day

### Task 5.1: Implement create_visualization

**Update `src/index.ts` - replace `handleCreateVisualization` method**:
```typescript
import { DatawrapperClient } from './datawrapper-client.js';
import { ChartBuilder } from './chart-builder.js';
import { ChartLogger } from './chart-logger.js';
import type { ChartData, ChartLogEntry } from './types.js';

class DatawrapperMCPServer {
  private server: Server;
  private dwClient: DatawrapperClient;
  private chartBuilder: ChartBuilder;
  private chartLogger: ChartLogger;

  constructor() {
    // ... existing constructor code ...

    this.dwClient = new DatawrapperClient();
    this.chartBuilder = new ChartBuilder();
    this.chartLogger = new ChartLogger();

    // ... rest of constructor ...
  }

  private async handleCreateVisualization(args: any) {
    try {
      const chartData: ChartData = {
        data: args.data,
        chart_type: args.chart_type,
        title: args.title,
        description: args.description,
        source_dataset_id: args.source_dataset_id,
      };

      console.error(`[CreateVisualization] Creating ${chartData.chart_type} chart...`);

      // 1. Generate chart config with smart defaults
      const config = this.chartBuilder.inferChartConfig(chartData);

      // 2. Create chart via Datawrapper API
      const chart = await this.dwClient.createChart(config);
      console.error(`[CreateVisualization] Chart created: ${chart.id}`);

      // 3. Format and upload data
      const formattedData = this.chartBuilder.formatDataForUpload(
        chartData.data,
        chartData.chart_type
      );
      await this.dwClient.uploadData(
        chart.id,
        formattedData,
        chartData.chart_type === 'map' ? 'json' : 'csv'
      );
      console.error(`[CreateVisualization] Data uploaded`);

      // 4. Publish chart
      const published = await this.dwClient.publishChart(chart.id);
      console.error(`[CreateVisualization] Chart published: ${published.url}`);

      // 5. Get embed code
      const embedCode = this.dwClient.getEmbedCode(published.publicId);

      // 6. Log chart
      const logEntry: ChartLogEntry = {
        chartId: chart.id,
        url: published.url,
        embedCode,
        editUrl: `https://app.datawrapper.de/chart/${chart.id}/visualize`,
        chartType: chartData.chart_type,
        title: config.title,
        createdAt: new Date().toISOString(),
        sourceDatasetId: chartData.source_dataset_id,
        dataRowCount: Array.isArray(chartData.data)
          ? chartData.data.length
          : chartData.data.features?.length || 0,
      };
      await this.chartLogger.logChart(logEntry);

      // 7. Format response
      const response = this.formatChartResponse(logEntry);

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      console.error('[CreateVisualization] Error:', error);

      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to create visualization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private formatChartResponse(entry: ChartLogEntry): string {
    return `✅ Chart created successfully!

[CHART:${entry.chartId}]
${entry.embedCode}
[/CHART]

📊 **Chart URL**: ${entry.url}
📝 **Embed code**: \`${entry.embedCode}\`
✏️ **Edit**: ${entry.editUrl}`;
  }

  // ... rest of class ...
}
```

---

### Task 5.2: Test End-to-End

**Create `tests/e2e/create-chart.test.ts`**:
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testCreateChart() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
  });

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('Connected to Datawrapper MCP server');

  // Test 1: Bar chart
  console.log('\nTest 1: Creating bar chart...');
  const barResult = await client.callTool({
    name: 'create_visualization',
    arguments: {
      data: [
        { district: 'Mitte', population: 380000 },
        { district: 'Pankow', population: 410000 },
        { district: 'Friedrichshain-Kreuzberg', population: 290000 },
      ],
      chart_type: 'bar',
      title: 'Population by District',
    },
  });

  console.log('Bar chart result:', barResult.content[0].text);

  // Test 2: Line chart
  console.log('\nTest 2: Creating line chart...');
  const lineResult = await client.callTool({
    name: 'create_visualization',
    arguments: {
      data: [
        { month: 'Jan', revenue: 1000 },
        { month: 'Feb', revenue: 1200 },
        { month: 'Mar', revenue: 1100 },
      ],
      chart_type: 'line',
      title: 'Monthly Revenue',
    },
  });

  console.log('Line chart result:', lineResult.content[0].text);

  await client.close();
  await transport.close();

  console.log('\n✅ All E2E tests passed!');
}

testCreateChart().catch(console.error);
```

**Run tests**:
```bash
npm run build
npx tsx tests/e2e/create-chart.test.ts
```

**Verify**: Charts are created on Datawrapper, URLs work, charts-log.json is updated.

**Commit**:
```bash
git add src/index.ts tests/e2e/
git commit -m "Implement create_visualization tool

- Wire together Datawrapper client, chart builder, and logger
- Add complete workflow: config → create → upload → publish → log
- Format response with embed code and URLs
- Add end-to-end tests for bar and line charts
"
```

---

## Phase 6: Interface-Prototype Integration

**Goal**: Integrate Datawrapper MCP with the web chat interface.

**Duration**: 1-2 days

### Task 6.1: Backend Integration

**Update `/Users/alsino/Desktop/ODIS/interface-prototype/backend/src/server.ts`**:
```typescript
// Add second MCP client manager
const datawrapperMcpPath = path.resolve(__dirname, '../../../datawrapper-mcp/dist/index.js');

const datawrapperClient = new MCPClientManager({
  serverPath: datawrapperMcpPath
});

console.log('Connecting to Datawrapper MCP server...');
await datawrapperClient.connect();
console.log('Connected to Datawrapper MCP server');

// Update WebSocketHandler to accept both clients
const wsHandler = new WebSocketHandler(mcpClient, claudeClient, datawrapperClient);
```

**Update `backend/src/websocket-handler.ts`**:
```typescript
export class WebSocketHandler {
  constructor(
    private berlinMcpClient: MCPClientManager,
    private claudeClient: ClaudeClient,
    private datawrapperMcpClient: MCPClientManager
  ) {
    // ... existing code ...
  }

  private async handleUserMessage(ws: WebSocket, message: UserMessage): Promise<void> {
    // ... existing code ...

    // Combine tools from both MCP servers
    const berlinTools = this.berlinMcpClient.getTools();
    const datawrapperTools = this.datawrapperMcpClient.getTools();
    const allTools = [...berlinTools, ...datawrapperTools, codeExecutionTool];

    // In tool execution callback, route to appropriate client
    async (toolName: string, toolArgs: any) => {
      if (toolName === 'execute_code') {
        // ... existing code ...
      } else if (toolName === 'create_visualization') {
        // Route to Datawrapper MCP
        return await this.datawrapperMcpClient.callTool(toolName, toolArgs);
      } else {
        // Route to Berlin MCP
        return await this.berlinMcpClient.callTool(toolName, toolArgs);
      }
    }

    // ... rest of existing code ...
  }
}
```

---

### Task 6.2: Frontend Integration

**Update `frontend/src/lib/Message.svelte`**:
```svelte
<script>
  import { marked } from 'marked';

  export let role = 'user';
  export let content = '';

  let htmlContent = '';

  $: {
    let html = marked.parse(content);

    // Handle [CHART:...] markers similar to [DOWNLOAD:...]
    html = html.replace(
      /\[CHART:([^\]]+)\]([\s\S]*?)\[\/CHART\]/g,
      (match, chartId, iframeCode) => {
        // Extract and render iframe
        return `<div class="chart-embed">${iframeCode}</div>`;
      }
    );

    // Add target="_blank" to external links
    htmlContent = html.replace(
      /<a href="(https?:\/\/[^"]+)"([^>]*)>/g,
      '<a href="$1"$2 target="_blank" rel="noopener noreferrer">'
    );
  }
</script>

<div class="message {role}">
  <div class="message-content">
    {@html htmlContent}
  </div>
</div>

<style>
  /* ... existing styles ... */

  /* Chart embed styles */
  .message-content :global(.chart-embed) {
    margin: 1.5rem 0;
    max-width: 100%;
  }

  .message-content :global(.chart-embed iframe) {
    width: 100%;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
</style>
```

---

### Task 6.3: Test Full Pipeline

**Test workflow**:
1. Start interface-prototype: `npm run dev`
2. Open browser to http://localhost:3000
3. Test conversation:
   - "Suche nach Daten zu Einwohnerzahlen in Berlin"
   - "Hole die Daten"
   - "Erstelle ein Balkendiagramm daraus"
4. Verify: Chart renders inline with URLs below

**Commit**:
```bash
git add ../interface-prototype/backend/ ../interface-prototype/frontend/
git commit -m "Integrate Datawrapper MCP with interface-prototype

- Add second MCP client for Datawrapper in backend
- Route tool calls to appropriate MCP server
- Handle [CHART:...] markers in frontend to render iframes
- Add chart embed styling
- Test complete workflow: search → fetch → visualize
"
```

---

## Phase 7: Documentation & Polish

**Goal**: Complete documentation and prepare for deployment.

**Duration**: 1 day

### Task 7.1: Update README

**Update `/Users/alsino/Desktop/ODIS/datawrapper-mcp/README.md`**:
```markdown
# Datawrapper MCP Server

MCP server for creating data visualizations using the Datawrapper API. Enables automatic chart generation from Berlin open data.

## Features

- **Bar charts**: Compare categories with vertical/horizontal bars
- **Line charts**: Visualize trends and time-series data
- **Maps**: Display GeoJSON data on interactive maps
- **Smart defaults**: Automatic title, axis, and label inference
- **Provenance tracking**: JSON log of all created charts

## Quick Start

### 1. Installation

```bash
npm install
npm run build
```

### 2. Configuration

Create `.env` file:
```bash
DATAWRAPPER_API_TOKEN=your_token_here
```

Get your API token from https://app.datawrapper.de/settings/api-tokens

### 3. Usage in Claude Desktop

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "datawrapper": {
      "command": "node",
      "args": ["/path/to/datawrapper-mcp/dist/index.js"],
      "env": {
        "DATAWRAPPER_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

### 4. Usage in Interface-Prototype

The Datawrapper MCP is automatically integrated. Try:
- "Suche nach Daten zu Parkplätzen"
- "Hole die Daten"
- "Erstelle eine Karte daraus"

## Examples

### Bar Chart
```javascript
{
  "data": [
    { "district": "Mitte", "population": 380000 },
    { "district": "Pankow", "population": 410000 }
  ],
  "chart_type": "bar",
  "title": "Population by District"
}
```

### Line Chart
```javascript
{
  "data": [
    { "month": "Jan", "revenue": 1000 },
    { "month": "Feb", "revenue": 1200 }
  ],
  "chart_type": "line"
}
```

### Map
```javascript
{
  "data": {
    "type": "FeatureCollection",
    "features": [...]
  },
  "chart_type": "map"
}
```

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## Documentation

- [Design Specification](docs/plans/design-spec.md)
- [Implementation Plan](docs/plans/implementation-plan.md)

## License

MIT
```

---

### Task 7.2: Create Examples

**Create `examples/` directory with sample datasets**:
```bash
mkdir examples
```

**Create `examples/bar-chart-example.json`**:
```json
{
  "data": [
    { "bezirk": "Mitte", "einwohner": 380946 },
    { "bezirk": "Friedrichshain-Kreuzberg", "einwohner": 290386 },
    { "bezirk": "Pankow", "einwohner": 409335 },
    { "bezirk": "Charlottenburg-Wilmersdorf", "einwohner": 342332 },
    { "bezirk": "Spandau", "einwohner": 245527 }
  ],
  "chart_type": "bar",
  "title": "Einwohner nach Bezirk",
  "description": "Bevölkerung der größten Berliner Bezirke"
}
```

**Commit**:
```bash
git add README.md examples/
git commit -m "Add documentation and examples

- Update README with quick start and usage instructions
- Add example datasets for testing
- Document configuration and API token setup
"
```

---

## Testing Checklist

### Unit Tests
- [ ] Column type detection works correctly
- [ ] Label formatting handles underscores and capitalization
- [ ] CSV conversion escapes special characters
- [ ] GeoJSON validation catches invalid structures

### Integration Tests
- [ ] Datawrapper API authentication works
- [ ] Charts can be created, uploaded, and published
- [ ] Error handling for API failures
- [ ] Chart logger writes and reads correctly

### End-to-End Tests
- [ ] Bar chart from Vornamen dataset
- [ ] Line chart from Steuereinnahmen dataset
- [ ] Map from Parkplätze WFS data
- [ ] Charts render in Claude Desktop
- [ ] Charts render in interface-prototype

---

## Deployment

### Claude Desktop
1. Build: `npm run build`
2. Update `claude_desktop_config.json` with server path
3. Restart Claude Desktop
4. Test: Ask Claude to "create a bar chart with this data: [...]"

### Interface-Prototype
1. Ensure both MCP servers are built
2. Start interface: `npm run dev`
3. Test full workflow in browser
4. Deploy to Railway/production as needed

---

## Troubleshooting

### "DATAWRAPPER_API_TOKEN is required"
- Check `.env` file exists and contains valid token
- Verify token has correct permissions in Datawrapper settings

### "Failed to create chart: 401"
- Token is invalid or expired
- Generate new token at https://app.datawrapper.de/settings/api-tokens

### Charts don't render in frontend
- Check browser console for errors
- Verify `[CHART:...]` markers are in response
- Check iframe CSP/CORS settings

### "Data exceeds Datawrapper limit"
- Filter or aggregate data before visualization
- Use `execute_code` tool to summarize data first

---

## Future Enhancements

See [design-spec.md](docs/plans/design-spec.md#future-enhancements) for planned features:
- Chart editing/updating
- Additional chart types (pie, scatter, area)
- Custom styling options
- Chart templates

---

*Last Updated: December 2025*
