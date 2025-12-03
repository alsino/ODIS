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
const CHART_TYPE_MAP: Record<ChartType, string> = {
  bar: 'd3-bars-stacked',
  line: 'd3-lines',
  map: 'd3-maps-symbols'
};

// Tool definitions
const CREATE_VISUALIZATION_TOOL: Tool = {
  name: 'create_visualization',
  description: 'Create a data visualization using the Datawrapper API. Supports bar charts, line charts, and maps (GeoJSON).',
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
    const { data, chart_type, title, description, source_dataset_id } = params;

    // Validate data
    chartBuilder.validateData(data, chart_type);

    // Infer chart configuration
    const config = chartBuilder.inferChartConfig(data, chart_type, title);

    // Get Datawrapper chart type
    const dwChartType = CHART_TYPE_MAP[chart_type];

    // Create initial chart metadata with shadcn-inspired styling
    const metadata: any = {
      visualize: {
        'base-color': '#3b82f6'
      }
    };

    if (config.title) {
      metadata.title = config.title;
    }

    if (description) {
      metadata.describe = {
        byline: description
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
    console.error(`Creating ${chart_type} chart...`);
    const chart = await datawrapperClient.createChart(dwChartType, metadata);

    // Prepare and upload data
    let dataString: string;
    let rowCount: number;

    if (chart_type === 'map') {
      dataString = chartBuilder.processGeoJSON(data as GeoJSON);
      rowCount = (data as GeoJSON).features.length;
    } else {
      const dataArray = data as Array<Record<string, any>>;
      dataString = chartBuilder.formatForDatawrapper(dataArray);
      rowCount = dataArray.length;
    }

    console.error(`Uploading data (${rowCount} rows)...`);
    await datawrapperClient.uploadData(chart.id, dataString);

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
    const responseText = `✅ Chart created successfully!

[CHART:${publicId}]
${embedCode}
[/CHART]

📊 **Chart URL**: ${publicUrl}
📝 **Embed code**: \`${embedCode}\`
✏️ **Edit**: ${editUrl}`;

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
