#!/usr/bin/env node
// ABOUTME: MCP server implementation for Berlin Open Data Portal
// ABOUTME: Handles tool registration and request routing for dataset discovery and data fetching

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BerlinOpenDataAPI } from './berlin-api.js';
import { QueryProcessor } from './query-processor.js';
import { DataFetcher } from './data-fetcher.js';
import { DataSampler } from './data-sampler.js';

class BerlinOpenDataMCPServer {
  private server: Server;
  private api: BerlinOpenDataAPI;
  private queryProcessor: QueryProcessor;
  private dataFetcher: DataFetcher;
  private dataSampler: DataSampler;

  constructor() {
    this.server = new Server(
      {
        name: 'berlin-opendata-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.api = new BerlinOpenDataAPI();
    this.queryProcessor = new QueryProcessor();
    this.dataFetcher = new DataFetcher({ useBrowserAutomation: true });
    this.dataSampler = new DataSampler();

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_berlin_datasets',
          description: 'Search Berlin open datasets using natural language queries. Perfect for discovering data about transportation, environment, demographics, etc.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query in German or English (e.g., "bicycle infrastructure", "Luftqualität", "public transport data")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 20)',
                default: 20,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_dataset_details',
          description: 'Get detailed information about a specific Berlin dataset',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'The ID or name of the dataset',
              },
            },
            required: ['dataset_id'],
          },
        },
        {
          name: 'discover_data_topics',
          description: 'Explore what types of data are available in Berlin. Shows popular categories, tags, and data themes.',
          inputSchema: {
            type: 'object',
            properties: {
              focus: {
                type: 'string',
                description: 'Optional focus area (e.g., "transportation", "environment", "demographics")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of items to return (default: 50)',
                default: 50,
              },
            },
          },
        },
        {
          name: 'suggest_datasets',
          description: 'Get intelligent dataset suggestions based on your interests or research needs',
          inputSchema: {
            type: 'object',
            properties: {
              interest: {
                type: 'string',
                description: 'What you are interested in or researching (e.g., "sustainable transport", "urban planning")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of suggestions (default: 10)',
                default: 10,
              },
            },
            required: ['interest'],
          },
        },
        {
          name: 'get_portal_stats',
          description: 'Get overview statistics about the Berlin Open Data Portal (total datasets, organizations, categories)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_all_datasets',
          description: 'List all datasets in the portal with pagination support. Use this to browse the entire catalog.',
          inputSchema: {
            type: 'object',
            properties: {
              offset: {
                type: 'number',
                description: 'Starting position (default: 0)',
                default: 0,
              },
              limit: {
                type: 'number',
                description: 'Number of results to return (default: 100, max: 1000)',
                default: 100,
              },
            },
          },
        },
        {
          name: 'list_dataset_resources',
          description: 'List all available resources (files) for a specific dataset. Shows formats and download URLs.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'The dataset ID or name',
              },
            },
            required: ['dataset_id'],
          },
        },
        {
          name: 'fetch_dataset_data',
          description: 'Download and parse Berlin Open Data datasets. Returns 10 sample rows initially. For small datasets (≤500 rows), use full_data: true to get all data. Large datasets must be downloaded manually.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'The dataset ID or name',
              },
              resource_id: {
                type: 'string',
                description: 'Optional: specific resource ID. If not provided, uses first available resource.',
              },
              full_data: {
                type: 'boolean',
                description: 'If true, return all data for small datasets (≤500 rows). Refused for large datasets.',
                default: false,
              },
            },
            required: ['dataset_id'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_berlin_datasets': {
            const { query, limit = 20 } = args as { query: string; limit?: number };

            const searchParams = this.queryProcessor.processQuery(query);
            searchParams.limit = limit;

            const results = await this.api.searchDatasets(searchParams);

            // Create a conversational, structured response
            let responseText = `# Search Results for "${query}"\n\n`;

            if (results.results.length === 0) {
              responseText += "I couldn't find any datasets matching your query. Try:\n";
              responseText += "- Using different keywords\n";
              responseText += "- Searching in German (e.g., 'Verkehr' instead of 'traffic')\n";
              responseText += "- Using discover_data_topics to explore available categories\n";
            } else {
              responseText += `Found ${results.count} relevant dataset(s)`;
              if (results.count > results.results.length) {
                responseText += ` (showing first ${results.results.length})`;
              }
              responseText += `:\n\n`;

              results.results.forEach((dataset, index) => {
                responseText += `## ${index + 1}. ${dataset.title}\n`;
                responseText += `**ID**: ${dataset.name}\n`;
                responseText += `**Organization**: ${dataset.organization?.title || 'Unknown'}\n`;

                if (dataset.notes && dataset.notes.length > 0) {
                  const description = dataset.notes.length > 200
                    ? dataset.notes.substring(0, 200) + '...'
                    : dataset.notes;
                  responseText += `**Description**: ${description}\n`;
                }

                if (dataset.resources && dataset.resources.length > 0) {
                  responseText += `**Resources**: ${dataset.resources.length} files available`;
                  const formats = [...new Set(dataset.resources.map(r => r.format).filter(Boolean))];
                  if (formats.length > 0) {
                    responseText += ` (${formats.join(', ')})`;
                  }
                  responseText += '\n';
                }

                if (dataset.tags && dataset.tags.length > 0) {
                  responseText += `**Tags**: ${dataset.tags.slice(0, 5).map(t => t.name).join(', ')}`;
                  if (dataset.tags.length > 5) {
                    responseText += ` +${dataset.tags.length - 5} more`;
                  }
                  responseText += '\n';
                }

                responseText += '\n';
              });

              responseText += `\n💡 **Next steps**:\n`;
              responseText += `- Use \`get_dataset_details\` with any dataset ID to get full details\n`;
              responseText += `- Use \`suggest_datasets\` to find related datasets\n`;
            }

            return {
              content: [
                {
                  type: 'text',
                  text: responseText,
                },
              ],
            };
          }

          case 'get_dataset_details': {
            const { dataset_id } = args as { dataset_id: string };
            const dataset = await this.api.getDataset(dataset_id);

            let details = `# ${dataset.title}\n\n`;

            // Basic information
            details += `## Overview\n`;
            details += `**ID**: ${dataset.id}\n`;
            details += `**Organization**: ${dataset.organization?.title || 'Unknown'}\n`;

            if (dataset.metadata_modified) {
              const lastUpdate = new Date(dataset.metadata_modified).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              details += `**Last Updated**: ${lastUpdate}\n`;
            }

            details += `\n## Description\n`;
            details += dataset.notes ? dataset.notes : 'No description available.';

            // Tags
            if (dataset.tags && dataset.tags.length > 0) {
              details += `\n\n## Categories & Tags\n`;
              details += dataset.tags.map(t => `\`${t.name}\``).join(', ');
            }

            // Resources
            details += `\n\n## Available Resources\n`;
            if (dataset.resources && dataset.resources.length > 0) {
              details += `This dataset contains ${dataset.resources.length} resource(s):\n\n`;

              dataset.resources.forEach((resource, index) => {
                details += `### ${index + 1}. ${resource.name || 'Unnamed Resource'}\n`;
                if (resource.format) {
                  details += `**Format**: ${resource.format}\n`;
                }
                if (resource.description) {
                  details += `**Description**: ${resource.description}\n`;
                }
                if (resource.url) {
                  details += `**Download URL**: ${resource.url}\n`;
                }
                details += '\n';
              });

              details += `💡 **How to use**: You can download these resources directly from the URLs above.\n`;
            } else {
              details += 'No downloadable resources are available for this dataset.\n';
            }

            // Additional metadata
            if (dataset.license_title || dataset.author || dataset.maintainer) {
              details += `\n## Additional Information\n`;
              if (dataset.license_title) {
                details += `**License**: ${dataset.license_title}\n`;
              }
              if (dataset.author) {
                details += `**Author**: ${dataset.author}\n`;
              }
              if (dataset.maintainer) {
                details += `**Maintainer**: ${dataset.maintainer}\n`;
              }
            }

            return {
              content: [
                {
                  type: 'text',
                  text: details,
                },
              ],
            };
          }

          case 'discover_data_topics': {
            const { focus, limit = 50 } = args as { focus?: string; limit?: number };
            const [tags, organizations] = await Promise.all([
              this.api.listTags(limit),
              this.api.listOrganizations(),
            ]);

            let topicsText = '# Berlin Open Data: Available Topics\n\n';

            if (focus) {
              const focusKeywords = focus.toLowerCase().split(' ');
              const relevantTags = tags.filter(t =>
                focusKeywords.some(keyword => t.name.toLowerCase().includes(keyword))
              );

              if (relevantTags.length > 0) {
                topicsText += `**${focus.charAt(0).toUpperCase() + focus.slice(1)}-related topics:**\n`;
                topicsText += relevantTags.map(t => `- ${t.name}`).join('\n');
                topicsText += '\n\n';
              }
            }

            topicsText += `**Popular data categories (${Math.min(tags.length, 20)} of ${tags.length}):**\n`;
            topicsText += tags.slice(0, 20).map(t => `- ${t.name}`).join('\n');
            topicsText += `\n\n**Data providers (${organizations.length} organizations):**\n`;
            topicsText += organizations.slice(0, 10).map(o => `- ${o.title}`).join('\n');

            if (organizations.length > 10) {
              topicsText += `\n... and ${organizations.length - 10} more organizations`;
            }

            return {
              content: [
                {
                  type: 'text',
                  text: topicsText,
                },
              ],
            };
          }

          case 'suggest_datasets': {
            const { interest, limit = 10 } = args as { interest: string; limit?: number };

            // Use the interest as a search query to find relevant datasets
            const searchParams = this.queryProcessor.processQuery(interest);
            searchParams.limit = limit;
            const results = await this.api.searchDatasets(searchParams);

            let suggestionsText = `# Dataset Suggestions for "${interest}"\n\n`;

            if (results.results.length > 0) {
              suggestionsText += `Found ${results.results.length} relevant datasets:\n\n`;
              results.results.forEach((dataset, index) => {
                suggestionsText += `**${index + 1}. ${dataset.title}**\n`;
                suggestionsText += `   - ID: ${dataset.name}\n`;
                suggestionsText += `   - Organization: ${dataset.organization?.title || 'Unknown'}\n`;
                if (dataset.notes && dataset.notes.length > 0) {
                  const shortDesc = dataset.notes.length > 150
                    ? dataset.notes.substring(0, 150) + '...'
                    : dataset.notes;
                  suggestionsText += `   - Description: ${shortDesc}\n`;
                }
                suggestionsText += `\n`;
              });

              suggestionsText += `\n*Tip: Use get_dataset_details with the dataset ID to learn more about any of these datasets.*`;
            } else {
              suggestionsText += 'No datasets found for this interest. Try different keywords or explore available topics with discover_data_topics.';
            }

            return {
              content: [
                {
                  type: 'text',
                  text: suggestionsText,
                },
              ],
            };
          }

          case 'get_portal_stats': {
            const stats = await this.api.getPortalStats();

            let responseText = '# Berlin Open Data Portal Statistics\n\n';
            responseText += `📊 **Total Datasets**: ${stats.total_datasets}\n`;
            responseText += `🏛️ **Organizations**: ${stats.total_organizations}\n`;
            responseText += `🏷️ **Categories/Tags**: ${stats.total_tags}\n`;

            responseText += '\n💡 **Next steps**:\n';
            responseText += '- Use `list_all_datasets` to browse all datasets\n';
            responseText += '- Use `discover_data_topics` to explore categories\n';
            responseText += '- Use `search_berlin_datasets` to find specific topics\n';

            return {
              content: [{ type: 'text', text: responseText }],
            };
          }

          case 'list_all_datasets': {
            const { offset = 0, limit = 100 } = args as { offset?: number; limit?: number };
            const result = await this.api.listAllDatasets(offset, limit);

            let responseText = `# All Berlin Open Datasets\n\n`;
            responseText += `Showing ${offset + 1}-${Math.min(offset + limit, result.total)} of ${result.total} datasets\n\n`;

            result.datasets.forEach((dataset: any, index: number) => {
              responseText += `${offset + index + 1}. **${dataset.title}** (ID: ${dataset.name})\n`;
            });

            if (offset + limit < result.total) {
              responseText += `\n📄 **More data available**: Use offset=${offset + limit} to see next page\n`;
            }

            responseText += `\n💡 Use \`get_dataset_details\` with any ID to see full information\n`;

            return {
              content: [{ type: 'text', text: responseText }],
            };
          }

          case 'list_dataset_resources': {
            const { dataset_id } = args as { dataset_id: string };
            const resources = await this.api.listDatasetResources(dataset_id);

            let responseText = `# Resources for Dataset\n\n`;

            if (resources.length === 0) {
              responseText += 'No downloadable resources found for this dataset.\n';
            } else {
              responseText += `Found ${resources.length} resource(s):\n\n`;

              resources.forEach((resource, index) => {
                responseText += `## ${index + 1}. ${resource.name}\n`;
                responseText += `**ID**: ${resource.id}\n`;
                responseText += `**Format**: ${resource.format}\n`;
                if (resource.description) {
                  responseText += `**Description**: ${resource.description}\n`;
                }
                responseText += `**URL**: ${resource.url}\n\n`;
              });

              responseText += `💡 Use \`fetch_dataset_data\` with the dataset ID to download and analyze the data.\n`;
            }

            return {
              content: [{ type: 'text', text: responseText }],
            };
          }

          case 'fetch_dataset_data': {
            const { dataset_id, resource_id, full_data = false } = args as {
              dataset_id: string;
              resource_id?: string;
              full_data?: boolean;
            };

            const LARGE_DATASET_THRESHOLD = 500;

            // Get dataset to find resources
            const dataset = await this.api.getDataset(dataset_id);

            if (!dataset.resources || dataset.resources.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `❌ No resources available for dataset "${dataset_id}". This dataset may not have downloadable files.`,
                }],
              };
            }

            // Select resource
            let resource;
            if (resource_id) {
              resource = dataset.resources.find(r => r.id === resource_id);
              if (!resource) {
                return {
                  content: [{
                    type: 'text',
                    text: `❌ Resource "${resource_id}" not found. Use \`list_dataset_resources\` to see available resources.`,
                  }],
                };
              }
            } else {
              // Smart resource selection - prefer data formats over HTML/other
              const dataFormats = ['CSV', 'JSON', 'XLSX', 'XLS', 'XML', 'WMS', 'WFS'];
              resource = dataset.resources.find(r =>
                dataFormats.includes(r.format?.toUpperCase())
              ) || dataset.resources[0]; // Fallback to first if no data format found
            }

            // Fetch the data
            const fetchedData = await this.dataFetcher.fetchResource(resource.url, resource.format);

            if (fetchedData.error) {
              return {
                content: [{
                  type: 'text',
                  text: `❌ Error fetching data: ${fetchedData.error}\n\nYou can try:\n- Using a different resource\n- Downloading manually from: ${resource.url}`,
                }],
              };
            }

            const totalRows = fetchedData.rows.length;
            const isLarge = totalRows > LARGE_DATASET_THRESHOLD;
            const sizeLabel = isLarge ? 'large' : 'small';

            let responseText = `# Data from: ${dataset.title}\n\n`;
            responseText += `**Resource**: ${resource.name} (${resource.format})\n\n`;

            // Handle full_data request for large datasets
            if (full_data && isLarge) {
              return {
                content: [{
                  type: 'text',
                  text: `❌ Dataset has ${totalRows} rows and is too large for direct analysis. Returning all data would risk context overflow.\n\n📥 **Download manually**: ${resource.url}\n\nOnce downloaded, attach the file to Claude Desktop for analysis.`,
                }],
              };
            }

            // Return full data for small datasets when requested
            if (full_data) {
              responseText += `Dataset has ${totalRows} rows. This is a **${sizeLabel} dataset**.\n\n`;
              responseText += `## Full Dataset\n\n`;
              responseText += `**Data:**\n\`\`\`json\n${JSON.stringify(fetchedData.rows, null, 2)}\n\`\`\`\n`;
              return {
                content: [{ type: 'text', text: responseText }],
              };
            }

            // Always return sample initially
            const sample = this.dataSampler.generateSample(
              fetchedData.rows,
              fetchedData.columns
            );

            responseText += `Dataset has ${totalRows} rows. This is a **${sizeLabel} dataset**.\n\n`;

            // Prominent warning for large datasets at the top
            if (isLarge) {
              responseText += `## ⚠️ Large Dataset Warning\n\n`;
              responseText += `This dataset has **${totalRows} rows** and cannot be analyzed completely in-context.\n\n`;
              responseText += `**To analyze the full dataset:**\n`;
              responseText += `1. Download from: ${resource.url}\n`;
              responseText += `2. Attach the file to Claude Desktop for analysis\n\n`;
              responseText += `Below is a 10-row preview for reference only.\n\n`;
              responseText += `---\n\n`;
            }

            responseText += `## Data Preview\n\n`;
            responseText += `**Columns (${fetchedData.columns.length}):** ${fetchedData.columns.join(', ')}\n\n`;
            responseText += `**Sample Data (first ${sample.sampleRows.length} rows):**\n`;
            responseText += `\`\`\`json\n${JSON.stringify(sample.sampleRows, null, 2)}\n\`\`\`\n\n`;

            if (!isLarge) {
              responseText += `💡 Use \`full_data: true\` to analyze all ${totalRows} rows.\n`;
            }

            return {
              content: [{ type: 'text', text: responseText }],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'berlin_data_discovery',
          description: 'Help discover relevant Berlin open datasets based on user needs',
          arguments: [
            {
              name: 'topic',
              description: 'The topic or domain you are interested in',
              required: true,
            },
            {
              name: 'use_case',
              description: 'What you plan to do with the data',
              required: false,
            },
          ],
        },
      ],
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'berlin_data_discovery') {
        const { topic, use_case } = args as { topic: string; use_case?: string };

        const promptText = `I need to find Berlin open datasets related to "${topic}"` +
          (use_case ? ` for ${use_case}` : '') +
          '. Please help me discover relevant datasets and provide information about their content, formats, and how to access them.';

        return {
          description: `Data discovery prompt for ${topic}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: promptText,
              },
            },
          ],
        };
      }

      throw new Error(`Unknown prompt: ${name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Berlin Open Data MCP Server running on stdio');
  }
}

const server = new BerlinOpenDataMCPServer();
server.run().catch(console.error);