#!/usr/bin/env node
// ABOUTME: MCP server for Datawrapper visualization integration
// ABOUTME: Exposes create_visualization tool for creating charts via Datawrapper API

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { DatawrapperClient } from './datawrapper-client.js';
import { ChartBuilder } from './chart-builder.js';
import { ChartLogger } from './chart-logger.js';
import { CreateVisualizationParams, ChartType, GeoJSON } from './types.js';

// Load environment variables
dotenv.config();

const DATAWRAPPER_API_TOKEN = process.env.DATAWRAPPER_API_TOKEN;
const CHART_LOG_PATH = process.env.CHART_LOG_PATH || './charts-log.json';

if (!DATAWRAPPER_API_TOKEN) {
  console.error('Error: DATAWRAPPER_API_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize components
const datawrapperClient = new DatawrapperClient(DATAWRAPPER_API_TOKEN);
const chartBuilder = new ChartBuilder();
const chartLogger = new ChartLogger(CHART_LOG_PATH);

// Create MCP server
const server = new Server(
  {
    name: 'datawrapper-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Map chart types to Datawrapper chart type identifiers
const CHART_TYPE_MAP: Record<string, string> = {
  bar: 'd3-bars-stacked',
  line: 'd3-lines'
};

// Tool definitions
const CREATE_VISUALIZATION_TOOL: Tool = {
  name: 'create_visualization',
  description: 'Create a data visualization using the Datawrapper API. Supports bar charts, line charts, and maps (GeoJSON). **For maps, map_type is REQUIRED**: If the user has not already specified which type of map they want, ask them ONCE to choose between: (1) "d3-maps-symbols" for point locations, or (2) "d3-maps-choropleth" for region comparison. Once the user has indicated their choice (even if they just say "option 1" or similar), proceed immediately with that choice - do NOT ask again.',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        description: 'Array of data objects or GeoJSON FeatureCollection for maps',
        oneOf: [
          {
            type: 'array',
            items: {
              type: 'object'
            }
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['FeatureCollection'] },
              features: { type: 'array' }
            }
          }
        ]
      },
      chart_type: {
        type: 'string',
        enum: ['bar', 'line', 'map'],
        description: 'Type of visualization to create'
      },
      map_type: {
        type: 'string',
        enum: ['d3-maps-symbols', 'd3-maps-choropleth'],
        description: 'REQUIRED when chart_type is "map". Choose "d3-maps-symbols" for showing point locations, or "d3-maps-choropleth" for comparing data across regions with color fills.'
      },
      title: {
        type: 'string',
        description: 'Optional chart title (auto-generated if omitted)'
      },
      description: {
        type: 'string',
        description: 'Optional chart description/byline'
      },
      source_dataset_id: {
        type: 'string',
        description: 'Optional Berlin dataset ID for tracking'
      }
    },
    required: ['data', 'chart_type']
  }
};

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [CREATE_VISUALIZATION_TOOL]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'create_visualization') {
    return await handleCreateVisualization(args as any as CreateVisualizationParams);
  }

  throw new Error(`Unknown tool: ${name}`);
});

/**
 * Handle create_visualization tool execution
 */
async function handleCreateVisualization(params: CreateVisualizationParams) {
  try {
    const { data, chart_type, map_type, title, description, source_dataset_id } = params;

    // Validate map_type is provided for maps
    if (chart_type === 'map' && !map_type) {
      throw new Error('map_type is required when chart_type is "map". Ask the user to choose: (1) "d3-maps-symbols" for point locations, or (2) "d3-maps-choropleth" for region comparison.');
    }

    // Validate data
    chartBuilder.validateData(data, chart_type);

    // Infer chart configuration
    const config = chartBuilder.inferChartConfig(data, chart_type, title);

    // Get Datawrapper chart type
    const dwChartType = chart_type === 'map' ? map_type! : CHART_TYPE_MAP[chart_type];

    // Create initial chart metadata with clean, modern styling
    const metadata: any = {
      visualize: {
        'base-color': '#2A7FFF',
        'thick': false,  // Moderate bar thickness for cleaner look
        'value-label-format': '0,0.[00]'  // Clean number formatting
      }
    };

    if (config.title) {
      metadata.title = config.title;
    }

    if (description) {
      metadata.describe = {
        intro: description  // Use intro for subtitle/description
      };
    }

    // Add chart-specific configuration
    if (chart_type === 'bar' || chart_type === 'line') {
      if (config.xAxis) {
        metadata.axes = {
          x: config.xAxis
        };
      }
    }

    // Create chart
    const chartTypeLabel = chart_type === 'map' ? `${map_type} map` : `${chart_type} chart`;
    console.error(`Creating ${chartTypeLabel}...`);
    const chart = await datawrapperClient.createChart(dwChartType, metadata);

    // Prepare and upload data
    let dataString: string;
    let rowCount: number;
    let sampleFeature: any = null;

    if (chart_type === 'map') {
      const geojson = data as GeoJSON;
      rowCount = geojson.features.length;

      // Get sample feature before stripping (for preview)
      sampleFeature = chartBuilder.getSampleFeature(geojson);

      // Strip unnecessary properties to reduce token usage
      const strippedGeoJSON = chartBuilder.stripGeoJSONProperties(geojson, map_type!);
      dataString = chartBuilder.processGeoJSON(strippedGeoJSON);
    } else {
      const dataArray = data as Array<Record<string, any>>;
      dataString = chartBuilder.formatForDatawrapper(dataArray);
      rowCount = dataArray.length;
    }

    console.error(`Uploading data (${rowCount} rows)...`);
    await datawrapperClient.uploadData(chart.id, dataString);

    // Update map view after data upload
    if (chart_type === 'map' && config.bbox) {
      console.error('Setting map view to data extent...');
      const { minLon, maxLon, minLat, maxLat } = config.bbox;
      const centerLon = (minLon + maxLon) / 2;
      const centerLat = (minLat + maxLat) / 2;

      const viewMetadata = {
        visualize: {
          ...metadata.visualize,
          view: {
            center: [centerLon, centerLat],
            zoom: 10,
            fit: {
              top: [centerLon, maxLat],
              right: [maxLon, centerLat],
              bottom: [centerLon, minLat],
              left: [minLon, centerLat]
            }
          }
        }
      };

      await datawrapperClient.updateMetadata(chart.id, viewMetadata);
    }

    // Publish chart
    console.error('Publishing chart...');
    const publishedChart = await datawrapperClient.publishChart(chart.id);

    // Get chart URLs
    const publicId = publishedChart.publicId || chart.id;
    const embedCode = datawrapperClient.getEmbedCode(publicId);
    const publicUrl = datawrapperClient.getPublicUrl(publicId);
    const editUrl = datawrapperClient.getEditUrl(chart.id);

    // Log chart creation
    await chartLogger.logChart({
      chartId: chart.id,
      url: publicUrl,
      embedCode,
      editUrl,
      chartType: chart_type,
      title: config.title,
      createdAt: new Date().toISOString(),
      sourceDatasetId: source_dataset_id,
      sourceDatasetUrl: source_dataset_id ? `https://daten.berlin.de/datensaetze/${source_dataset_id}` : undefined,
      dataRowCount: rowCount
    });

    // Format response
    let responseText = `✅ Chart created successfully!

[CHART:${publicId}]
${embedCode}
[/CHART]

📊 **Chart URL**: ${publicUrl}
✏️ **Edit**: ${editUrl}`;

    // Add sample feature preview for maps
    if (chart_type === 'map' && sampleFeature) {
      responseText += `

📍 **Map type**: ${map_type}
📦 **Features**: ${rowCount}
🔍 **Sample feature**:
\`\`\`json
${JSON.stringify(sampleFeature, null, 2)}
\`\`\``;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  } catch (error: any) {
    console.error('Error creating visualization:', error);

    return {
      content: [
        {
          type: 'text',
          text: `❌ ${error.message}`
        }
      ],
      isError: true
    };
  }
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Datawrapper MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
