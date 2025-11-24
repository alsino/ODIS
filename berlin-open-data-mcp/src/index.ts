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
          name: 'fetch_dataset_data',
          description: 'VIEW dataset content in the chat for analysis. Returns a preview (10 sample rows) or full data for small datasets. Use when user wants to SEE/ANALYZE data, not download it. Keywords: "zeig mir", "schau dir an", "wie sieht aus", "analysiere".',
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
        {
          name: 'download_dataset',
          description: 'DOWNLOAD dataset as a file to the user\'s computer. Triggers browser download dialog. Use when user wants to SAVE/DOWNLOAD the file. Keywords: "herunterladen", "download", "speichern", "save", "auf meinem Computer", "als Datei". Always use this tool when user says they need the data on their computer.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'The dataset ID or name',
              },
              resource_id: {
                type: 'string',
                description: 'Optional: specific resource ID. If not provided, uses first available data resource (CSV/JSON/Excel).',
              },
              format: {
                type: 'string',
                description: 'Output format: "csv" or "json". If not specified, uses resource format.',
                enum: ['csv', 'json'],
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

            // Three-Tier Search Strategy for Optimal Relevance
            // ================================================
            //
            // TIER 1 - Expansion Search (Broad Coverage):
            //   Expands query terms using portal metadata mappings
            //   Example: "Einwohner" → ["Einwohnerinnen", "Kleinräumige einwohnerzahl", ...]
            //   Purpose: Find all potentially relevant datasets (high recall)
            //
            // TIER 2 - Smart Fallback Detection:
            //   Checks if top 5 expansion results contain ALL user's key terms
            //   Purpose: Detect when expansion search found exact matches
            //
            // TIER 3 - Literal Search + Year Boosting (Precision):
            //   If no exact match in top 5, runs literal CKAN search
            //   Applies position-based scoring (1st=1000, 2nd=999, etc.)
            //   Adds +1000 bonus for datasets containing query year
            //   Purpose: Ensure specific queries return exact matches first
            //   Example: "Einwohner 2024" → 2024 dataset ranked #1 (not 2020/2019)
            //
            // Result: Best of both worlds - broad coverage + precise ranking

            // STEP 1: Expansion Search
            const searchTerms = this.queryProcessor.extractSearchTerms(query);

            // Search for each term separately and combine results
            const searchPromises = searchTerms.map(term =>
              this.api.searchDatasets({ query: term, limit: limit * 2 })
            );

            const allResults = await Promise.all(searchPromises);

            // Merge and deduplicate results by dataset ID
            const datasetMap = new Map<string, { dataset: any; matchCount: number; isLiteral: boolean }>();

            allResults.forEach(result => {
              result.results.forEach(dataset => {
                if (datasetMap.has(dataset.id)) {
                  // Dataset already found - increment match count
                  datasetMap.get(dataset.id)!.matchCount++;
                } else {
                  // New dataset - add it
                  datasetMap.set(dataset.id, { dataset, matchCount: 1, isLiteral: false });
                }
              });
            });

            // STEP 2: Smart Fallback - Check if expansion search found exact matches
            // Extract key terms from original query (including years and significant words)
            const cleanedQuery = query.replace(/\b(find|search|show|me|list|all|datasets?|about|in|for|the|and)\b/gi, '').trim();
            const keyTerms = cleanedQuery.split(/\s+/).filter(term =>
              term.length >= 3 || /^\d{4}$/.test(term) // Include 4-digit years
            );

            // Get top 5 results from expansion search to check quality
            const topExpansionResults = Array.from(datasetMap.values())
              .sort((a, b) => b.matchCount - a.matchCount)
              .slice(0, 5)
              .map(item => item.dataset);

            // Check if any top result contains ALL user's key terms (exact match)
            const hasExactMatch = topExpansionResults.some(dataset => {
              const searchableText = `${dataset.title} ${dataset.name} ${dataset.notes || ''}`.toLowerCase();
              return keyTerms.every(term => searchableText.includes(term.toLowerCase()));
            });

            // STEP 3: Literal Search Fallback (if expansion didn't find exact match)
            // This ensures specific queries like "Einwohner 2024" return the 2024 dataset first,
            // even if expansion search ranked older datasets higher due to more term matches
            if (!hasExactMatch && cleanedQuery.length > 0) {
              const literalResult = await this.api.searchDatasets({ query: cleanedQuery, limit: limit });

              // Detect if query contains a year for temporal relevance boosting
              const yearMatch = cleanedQuery.match(/\b(\d{4})\b/);
              const queryYear = yearMatch ? yearMatch[1] : null;

              // Apply position-based scoring to literal results
              // CKAN returns most relevant first, so we trust its ranking
              literalResult.results.forEach((dataset, index) => {
                // Base score: Position-based (1000, 999, 998, ...)
                let positionBoost = 1000 - index;

                // Temporal relevance boost: Add +1000 if dataset contains query year
                // Example: "Einwohner 2024" → datasets with "2024" get massive boost
                if (queryYear) {
                  const datasetText = `${dataset.title} ${dataset.name}`.toLowerCase();
                  if (datasetText.includes(queryYear)) {
                    positionBoost += 1000;
                  }
                }

                if (datasetMap.has(dataset.id)) {
                  // Dataset already found by expansion - override score with literal match score
                  const item = datasetMap.get(dataset.id)!;
                  item.isLiteral = true;
                  item.matchCount = positionBoost;
                } else {
                  // New dataset from literal search - add with high priority
                  datasetMap.set(dataset.id, { dataset, matchCount: positionBoost, isLiteral: true });
                }
              });
            }

            // Sort by match count (literal matches boosted to top)
            const combinedResults = Array.from(datasetMap.values())
              .sort((a, b) => b.matchCount - a.matchCount)
              .slice(0, limit)
              .map(item => item.dataset);

            const totalUnique = datasetMap.size;

            // Create a conversational, structured response
            let responseText = `# Search Results for "${query}"\n\n`;

            if (combinedResults.length === 0) {
              responseText += "I couldn't find any datasets matching your query. Try:\n";
              responseText += "- Using different keywords\n";
              responseText += "- Searching in German (e.g., 'Verkehr' instead of 'traffic')\n";
            } else {
              responseText += `Found ${totalUnique} relevant dataset(s)`;
              if (searchTerms.length > 1) {
                responseText += ` (searched: ${searchTerms.join(', ')})`;
              }
              if (totalUnique > combinedResults.length) {
                responseText += ` (showing top ${combinedResults.length})`;
              }
              responseText += `:\n\n`;

              combinedResults.forEach((dataset, index) => {
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
                  const formats = [...new Set(dataset.resources.map((r: any) => r.format).filter(Boolean))];
                  if (formats.length > 0) {
                    responseText += ` (${formats.join(', ')})`;
                  }
                  responseText += '\n';
                }

                if (dataset.tags && dataset.tags.length > 0) {
                  responseText += `**Tags**: ${dataset.tags.slice(0, 5).map((t: any) => t.name).join(', ')}`;
                  if (dataset.tags.length > 5) {
                    responseText += ` +${dataset.tags.length - 5} more`;
                  }
                  responseText += '\n';
                }

                responseText += '\n';
              });

              responseText += `\n💡 **Next steps**:\n`;
              responseText += `- Use \`get_dataset_details\` with any dataset ID to get full details\n`;
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
                if (resource.id) {
                  details += `**Resource ID**: ${resource.id}\n`;
                }
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

              details += `💡 **How to use**: You can download these resources directly from the URLs above, or use \`fetch_dataset_data\` with the Resource ID to download and analyze the data.\n`;
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

          case 'get_portal_stats': {
            const stats = await this.api.getPortalStats();

            let responseText = '# Berlin Open Data Portal Statistics\n\n';
            responseText += `📊 **Total Datasets**: ${stats.total_datasets}\n`;
            responseText += `🏛️ **Organizations**: ${stats.total_organizations}\n`;
            responseText += `🏷️ **Categories/Tags**: ${stats.total_tags}\n`;

            responseText += '\n💡 **Next steps**:\n';
            responseText += '- Use `list_all_datasets` to browse all datasets\n';
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
                    text: `❌ Resource "${resource_id}" not found. Use \`get_dataset_details\` to see available resources and their IDs.`,
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
              responseText += `## ⚠️ LARGE DATASET - MANUAL DOWNLOAD REQUIRED\n\n`;
              responseText += `This dataset has **${totalRows} rows** and CANNOT be analyzed in-context.\n\n`;
              responseText += `**CRITICAL: Do NOT attempt automated downloads or create sample/synthetic data.**\n\n`;
              responseText += `**REQUIRED STEPS for analysis:**\n\n`;
              responseText += `1. **Manual download ONLY:** Open ${resource.url} in your browser and save the file\n`;
              responseText += `2. **Attach the downloaded file** to this conversation using the paperclip icon\n`;
              responseText += `3. **Wait for confirmation** that the file is loaded before proceeding with analysis\n\n`;
              responseText += `**DO NOT:**\n`;
              responseText += `- ❌ Use wget, curl, or requests to download (proxy errors)\n`;
              responseText += `- ❌ Create synthetic/sample data based on the preview\n`;
              responseText += `- ❌ Extrapolate from the 10-row preview below\n\n`;
              responseText += `The 10-row preview below is for REFERENCE ONLY and must NOT be used for analysis.\n\n`;
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

          case 'download_dataset': {
            const { dataset_id, resource_id, format: requestedFormat } = args as {
              dataset_id: string;
              resource_id?: string;
              format?: 'csv' | 'json';
            };

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

            // Select resource - prefer data formats
            let resource;
            if (resource_id) {
              resource = dataset.resources.find(r => r.id === resource_id);
              if (!resource) {
                return {
                  content: [{
                    type: 'text',
                    text: `❌ Resource "${resource_id}" not found. Use \`get_dataset_details\` to see available resources and their IDs.`,
                  }],
                };
              }
            } else {
              // Smart resource selection - prefer data formats over HTML/other
              const dataFormats = ['CSV', 'JSON', 'XLSX', 'XLS', 'XML', 'WMS', 'WFS'];
              resource = dataset.resources.find(r =>
                dataFormats.includes(r.format?.toUpperCase())
              ) || dataset.resources[0];
            }

            // Fetch the data
            const fetchedData = await this.dataFetcher.fetchResource(resource.url, resource.format);

            if (fetchedData.error) {
              return {
                content: [{
                  type: 'text',
                  text: `❌ Error downloading data: ${fetchedData.error}\n\nYou can try:\n- Using a different resource\n- Downloading manually from: ${resource.url}`,
                }],
              };
            }

            // Determine output format
            const outputFormat = requestedFormat || (resource.format.toLowerCase() === 'csv' ? 'csv' : 'json');

            // Generate file content
            let fileContent: string;
            let mimeType: string;
            let fileExtension: string;

            if (outputFormat === 'csv') {
              // Convert to CSV
              if (fetchedData.rows.length > 0) {
                const header = fetchedData.columns.join(',') + '\n';
                const rows = fetchedData.rows.map(row => {
                  return fetchedData.columns.map(col => {
                    const val = row[col];
                    // Escape CSV values with commas or quotes
                    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                      return `"${val.replace(/"/g, '""')}"`;
                    }
                    return val ?? '';
                  }).join(',');
                }).join('\n');
                fileContent = header + rows;
              } else {
                fileContent = fetchedData.columns.join(',');
              }
              mimeType = 'text/csv';
              fileExtension = 'csv';
            } else {
              // JSON format
              fileContent = JSON.stringify(fetchedData.rows, null, 2);
              mimeType = 'application/json';
              fileExtension = 'json';
            }

            // Generate filename from dataset title
            const safeFilename = dataset.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .substring(0, 50);
            const filename = `${safeFilename}.${fileExtension}`;

            const fileSizeKB = (fileContent.length / 1024).toFixed(2);

            // Return with special marker for download
            let responseText = `✅ **Download ready!**\n\n`;
            responseText += `**Dataset:** ${dataset.title}\n`;
            responseText += `**Format:** ${outputFormat.toUpperCase()}\n`;
            responseText += `**Size:** ${fileSizeKB} KB\n`;
            responseText += `**Rows:** ${fetchedData.rows.length}\n`;
            responseText += `**Columns:** ${fetchedData.columns.length}\n\n`;
            responseText += `[DOWNLOAD:${filename}:${mimeType}]\n`;
            responseText += fileContent;

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