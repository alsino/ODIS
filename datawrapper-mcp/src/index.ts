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
import { CreateVisualizationParams, ChartType, ChartVariant, GeoJSON, BerlinBasemap } from './types.js';
import { BasemapMatcher } from './basemap-matcher.js';

/**
 * Get default visualize settings for chart types that need them
 */
function getDefaultVisualizeSettings(chartType: ChartType, variant?: ChartVariant): Record<string, any> {
  switch (chartType) {
    case 'range':
    case 'arrow':
      return {
        'show-value-labels': true,
        'range-value-labels': 'both',
        'label-first-range': true,
        'show-color-key': true,  // Show legend for column labels
      };
    case 'dot':
      return {
        'show-value-labels': true,
        'range-value-labels': 'both',
        'label-first-range': true,
        'show-color-key': true,
      };
    case 'bar':
    case 'column':
      // Stacked, grouped, and split charts need a legend to understand the colors
      if (variant === 'stacked' || variant === 'grouped' || variant === 'split') {
        return {
          'show-color-key': true,
        };
      }
      return {};
    case 'line':
    case 'area':
      // Multi-series line/area charts need a legend
      return {
        'show-color-key': true,
      };
    case 'pie':
    case 'donut':
    case 'election-donut':
      // Pie/donut charts always need a legend
      return {
        'show-color-key': true,
      };
    default:
      return {};
  }
}

/**
 * Handle choropleth map detection - returns detection info without creating chart
 */
function formatDetectionResponse(detection: import('./types.js').DetectionResult): string {
  if (!detection.detected) {
    return `❌ Could not detect Berlin region data.

Please ensure your data contains a column with one of:
- Bezirk IDs (BEZ_ID) or names (e.g., "Mitte", "Pankow")
- Prognoseraum IDs (PGR_ID) or names
- Bezirksregion IDs (BZR_ID) or names
- Planungsraum IDs (PLR_ID) or names

Found columns: ${Object.keys(detection.totalRows > 0 ? {} : {}).join(', ') || 'none'}`;
  }

  const primary = detection.primaryLevel!;
  let response = `✅ Detected Berlin ${primary.label} data

**Detected level:** ${primary.label} (${primary.count} regions)
**Region column:** ${detection.regionColumn}
**Value column:** ${detection.valueColumn || 'none found'}
**Match rate:** ${detection.matchedRows}/${detection.totalRows} rows`;

  if (detection.unmatchedValues && detection.unmatchedValues.length > 0) {
    response += `\n**Unmatched values:** ${detection.unmatchedValues.join(', ')}`;
  }

  if (detection.allLevels.length > 1) {
    response += `\n\n**Available aggregation levels:**`;
    for (const level of detection.allLevels) {
      const isCurrent = level.basemap === primary.basemap;
      response += `\n- ${level.label} (${level.count} regions)${isCurrent ? ' ← detected' : ' - requires aggregation'}`;
    }
  }

  response += `\n\n**To create the map**, call again with:
- \`basemap: "${primary.basemap}"\`${detection.allLevels.length > 1 ? ' (or choose another level)' : ''}`;

  return response;
}

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
const basemapMatcher = new BasemapMatcher();

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

// Tool definitions
const CREATE_VISUALIZATION_TOOL: Tool = {
  name: 'create_visualization',
  description: 'Create a data visualization using the Datawrapper API. Supports bar, column, line, area, scatter, dot, range, arrow, pie, donut, election-donut, table, and map charts. Use "variant" for bar (basic/stacked/split) and column (basic/grouped/stacked) charts. **For maps, map_type is REQUIRED**: "d3-maps-symbols" (points with GeoJSON) or "d3-maps-choropleth" (regions with tabular data). **For choropleth maps**: provide tabular data with Berlin region identifiers (Bezirke, Prognoseräume, Bezirksregionen, or Planungsräume). If basemap is not specified, the tool will auto-detect and return available options.',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        description: 'Array of data objects. For choropleth maps: tabular data with region IDs/names. For symbol maps: GeoJSON FeatureCollection.',
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
        enum: ['bar', 'column', 'line', 'area', 'scatter', 'dot', 'range', 'arrow', 'pie', 'donut', 'election-donut', 'table', 'map'],
        description: 'Type of visualization to create'
      },
      variant: {
        type: 'string',
        enum: ['basic', 'stacked', 'grouped', 'split'],
        description: 'Chart variant. For bar: basic (default), stacked, split. For column: basic (default), grouped, stacked.'
      },
      map_type: {
        type: 'string',
        enum: ['d3-maps-symbols', 'd3-maps-choropleth'],
        description: 'REQUIRED when chart_type is "map". "d3-maps-symbols" for point locations (requires GeoJSON), "d3-maps-choropleth" for region comparison (requires tabular data with Berlin region identifiers).'
      },
      basemap: {
        type: 'string',
        enum: ['berlin-boroughs', 'berlin-prognoseraume-2021', 'berlin-bezreg-2021', 'berlin-planungsraeume-2021'],
        description: 'For choropleth maps: explicitly select basemap. If omitted, auto-detects from data and returns options for confirmation.'
      },
      region_column: {
        type: 'string',
        description: 'For choropleth maps: column name containing region IDs or names. Auto-detected if omitted.'
      },
      value_column: {
        type: 'string',
        description: 'For choropleth maps: column name containing values to visualize. Auto-detected if omitted.'
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
    const { data, chart_type, variant, map_type, basemap, region_column, value_column, title, description, source_dataset_id } = params;

    // Validate map_type is provided for maps
    if (chart_type === 'map' && !map_type) {
      throw new Error('map_type is required when chart_type is "map". Choose: (1) "d3-maps-symbols" for point locations (requires GeoJSON), or (2) "d3-maps-choropleth" for region comparison (requires tabular data with Berlin region identifiers).');
    }

    // Handle choropleth maps separately
    if (chart_type === 'map' && map_type === 'd3-maps-choropleth') {
      return await handleChoroplethMap(params);
    }

    // Validate data structure for the chart type
    if (chart_type !== 'map') {
      const dataArray = data as Array<Record<string, any>>;
      const validation = chartBuilder.validateDataForChartType(dataArray, chart_type, variant);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    } else {
      // For maps, use the existing validation
      chartBuilder.validateData(data, chart_type);
    }

    // Infer chart configuration
    const config = chartBuilder.inferChartConfig(data, chart_type, title);

    // Get Datawrapper chart type
    const dwChartType = chart_type === 'map' ? map_type! : chartBuilder.getDatawrapperType(chart_type, variant);

    // Get chart-type-specific visualize settings
    const typeSpecificSettings = getDefaultVisualizeSettings(chart_type, variant);

    // Create initial chart metadata with clean, modern styling
    const metadata: any = {
      visualize: {
        'base-color': '#2A7FFF',
        'thick': false,  // Moderate bar thickness for cleaner look
        'value-label-format': '0,0.[00]',  // Clean number formatting
        ...typeSpecificSettings,  // Add type-specific settings (labels for range/arrow/dot)
      },
      publish: chart_type === 'map' ? {
        'embed-width': 600,
        'embed-height': 600  // Square aspect ratio for maps to avoid cropping
      } : undefined
    };

    if (config.title) {
      metadata.title = config.title;
    }

    // Add description and source information
    if (description || source_dataset_id) {
      metadata.describe = {};
      if (description) {
        metadata.describe.intro = description;
      }
      if (source_dataset_id) {
        metadata.describe['source-name'] = 'Berlin Open Data';
        metadata.describe['source-url'] = `https://daten.berlin.de/datensaetze/${source_dataset_id}`;
      }
    }

    // Add chart-specific configuration
    if (['bar', 'column', 'line', 'area'].includes(chart_type)) {
      if (config.xAxis) {
        metadata.axes = {
          x: config.xAxis
        };
      }
    } else if (chart_type === 'scatter') {
      // Scatter plots need axes.labels for data point labels
      const dataArray = data as Array<Record<string, any>>;
      const cols = chartBuilder.analyzeColumns(dataArray);
      if (cols.categorical.length > 0 && cols.numeric.length >= 2) {
        metadata.axes = {
          x: cols.numeric[0],
          y: cols.numeric[1],
          labels: cols.categorical[0]  // Use first categorical column for labels
        };
      }
    } else if (chart_type === 'map' && map_type === 'd3-maps-symbols' && config.basemap) {
      // Set basemap for symbol maps
      metadata.visualize.basemap = config.basemap;
      // Prevent edge cropping
      metadata.visualize['map-type'] = 'map-symbol';
      metadata.visualize['fitcontent'] = false;  // Show full basemap, don't crop
    }

    // Create chart
    const variantLabel = variant && variant !== 'basic' ? ` (${variant})` : '';
    const chartTypeLabel = chart_type === 'map' ? `${map_type} map` : `${chart_type}${variantLabel} chart`;
    console.error(`Creating ${chartTypeLabel}...`);
    const chart = await datawrapperClient.createChart(dwChartType, metadata);

    // Prepare and upload data
    let dataString: string;
    let rowCount: number;
    let sampleFeature: any = null;

    if (chart_type === 'map') {
      const geojson = data as GeoJSON;
      rowCount = geojson.features.length;

      // Get sample feature (for preview)
      sampleFeature = chartBuilder.getSampleFeature(geojson);

      // For symbol maps, convert directly to CSV (no stripping needed)
      // For choropleth maps, strip properties first to reduce data size
      if (map_type === 'd3-maps-symbols') {
        dataString = chartBuilder.processGeoJSON(geojson, map_type);
      } else {
        const strippedGeoJSON = chartBuilder.stripGeoJSONProperties(geojson, map_type!);
        dataString = chartBuilder.processGeoJSON(strippedGeoJSON, map_type!);
      }
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
    const embedCode = chart_type === 'map'
      ? datawrapperClient.getEmbedCode(publicId, 600, 600)  // Square for maps
      : datawrapperClient.getEmbedCode(publicId);
    const publicUrl = datawrapperClient.getPublicUrl(publicId);
    const editUrl = datawrapperClient.getEditUrl(chart.id);

    // Log chart creation asynchronously (don't wait for it)
    chartLogger.logChart({
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
    }).catch(err => console.error('Background logging failed:', err));

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

/**
 * Handle choropleth map creation with Berlin basemaps
 */
async function handleChoroplethMap(params: CreateVisualizationParams) {
  const { data, basemap, region_column, value_column, title, description, source_dataset_id } = params;

  // Choropleth maps require tabular data, not GeoJSON
  if (!Array.isArray(data)) {
    throw new Error('Choropleth maps require tabular data (array of objects), not GeoJSON. For GeoJSON point data, use map_type: "d3-maps-symbols" instead.');
  }

  const dataArray = data as Array<Record<string, any>>;

  if (dataArray.length === 0) {
    throw new Error('Cannot create choropleth map: Data array is empty.');
  }

  // Detect available LOR levels
  const detection = basemapMatcher.detectAvailableLevels(dataArray);

  // If no basemap specified, return detection info for user confirmation
  if (!basemap) {
    return {
      content: [
        {
          type: 'text',
          text: formatDetectionResponse(detection)
        }
      ]
    };
  }

  // Validate specified basemap
  const level = basemapMatcher.getLevelByBasemap(basemap);
  if (!level) {
    throw new Error(`Unknown basemap: ${basemap}. Valid options: berlin-boroughs, berlin-prognoseraume-2021, berlin-bezreg-2021, berlin-planungsraeume-2021`);
  }

  // Determine region column
  const regionCol = region_column || detection.regionColumn;
  if (!regionCol) {
    throw new Error(`Could not detect region column for ${level.label}. Please specify region_column parameter.`);
  }

  // Determine value column
  const valueCol = value_column || detection.valueColumn;
  if (!valueCol) {
    throw new Error('Choropleth maps require at least one numeric column for visualization. Please specify value_column parameter.');
  }

  // Check if using IDs or names
  const usingIds = basemapMatcher.isUsingIds(dataArray, regionCol, level);
  const keyAttr = usingIds ? level.idKey : level.nameKey;

  // Prepare data - transform region column if needed (BEZ_ID padding)
  let processedData = dataArray;
  if (usingIds && basemap === 'berlin-boroughs') {
    processedData = dataArray.map(row => ({
      ...row,
      [regionCol]: basemapMatcher.padBezirkId(String(row[regionCol]))
    }));
  }

  // Build metadata for choropleth map
  const metadata: any = {
    title: title || `${level.label} Map`,
    visualize: {
      basemap: basemap,
      'map-key-attr': keyAttr,
    },
    axes: {
      keys: regionCol,
      values: valueCol
    },
    publish: {
      'embed-width': 600,
      'embed-height': 600
    }
  };

  // Add description and source
  if (description || source_dataset_id) {
    metadata.describe = {};
    if (description) {
      metadata.describe.intro = description;
    }
    if (source_dataset_id) {
      metadata.describe['source-name'] = 'Berlin Open Data';
      metadata.describe['source-url'] = `https://daten.berlin.de/datensaetze/${source_dataset_id}`;
    }
  }

  // Create chart
  console.error(`Creating choropleth map with ${basemap}...`);
  const chart = await datawrapperClient.createChart('d3-maps-choropleth', metadata);

  // Convert data to CSV and upload
  const csvData = chartBuilder.formatForDatawrapper(processedData);
  console.error(`Uploading data (${processedData.length} rows)...`);
  await datawrapperClient.uploadData(chart.id, csvData);

  // Publish chart
  console.error('Publishing chart...');
  const publishedChart = await datawrapperClient.publishChart(chart.id);

  // Get chart URLs
  const publicId = publishedChart.publicId || chart.id;
  const embedCode = datawrapperClient.getEmbedCode(publicId, 600, 600);
  const publicUrl = datawrapperClient.getPublicUrl(publicId);
  const editUrl = datawrapperClient.getEditUrl(chart.id);

  // Log chart creation
  chartLogger.logChart({
    chartId: chart.id,
    url: publicUrl,
    embedCode,
    editUrl,
    chartType: 'map',
    title: metadata.title,
    createdAt: new Date().toISOString(),
    sourceDatasetId: source_dataset_id,
    sourceDatasetUrl: source_dataset_id ? `https://daten.berlin.de/datensaetze/${source_dataset_id}` : undefined,
    dataRowCount: processedData.length
  }).catch(err => console.error('Background logging failed:', err));

  // Format response
  const responseText = `✅ Choropleth map created successfully!

[CHART:${publicId}]
${embedCode}
[/CHART]

📊 **Chart URL**: ${publicUrl}
✏️ **Edit**: ${editUrl}

🗺️ **Basemap**: ${basemap} (${level.label})
📍 **Region column**: ${regionCol} (using ${usingIds ? 'IDs' : 'names'})
📈 **Value column**: ${valueCol}
📦 **Regions**: ${processedData.length}`;

  return {
    content: [
      {
        type: 'text',
        text: responseText
      }
    ]
  };
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
