#!/usr/bin/env node
// ABOUTME: MCP server for generating Masterportal geodata portals
// ABOUTME: Exposes add_layer, configure_map, and generate_portal tools

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { SessionManager } from './session-manager.js';
import { DataFetcher } from './data-fetcher.js';
import { ZipBuilder } from './zip-builder.js';
import { AddLayerParams, ConfigureMapParams, GeneratePortalParams } from './types.js';

dotenv.config();

// Tool definitions
const ADD_LAYER_TOOL: Tool = {
  name: 'add_layer',
  description: 'Add a geodata layer to the portal. Can be called multiple times to add more layers. Either data (inline GeoJSON string) or url (URL to GeoJSON file or WFS endpoint) must be provided.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique layer identifier',
      },
      name: {
        type: 'string',
        description: 'Display name in layer tree',
      },
      type: {
        type: 'string',
        enum: ['geojson', 'wfs'],
        description: 'Data type: "geojson" or "wfs"',
      },
      data: {
        type: 'string',
        description: 'Inline GeoJSON string (for small datasets)',
      },
      url: {
        type: 'string',
        description: 'URL to GeoJSON file or WFS endpoint',
      },
      style: {
        type: 'object',
        properties: {
          color: { type: 'string', description: 'Feature color (hex)' },
          opacity: { type: 'number', description: 'Opacity 0-1' },
          icon: { type: 'string', description: 'Icon URL for point features' },
        },
        description: 'Optional styling',
      },
    },
    required: ['id', 'name', 'type'],
  },
};

const CONFIGURE_MAP_TOOL: Tool = {
  name: 'configure_map',
  description: 'Set portal metadata and map defaults. Call before generate_portal to customize the portal.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Portal title',
      },
      center: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Initial center [longitude, latitude]. Default: Berlin [13.4, 52.52]',
      },
      zoom: {
        type: 'number',
        description: 'Initial zoom level (1-18). Default: 10',
      },
      basemap_url: {
        type: 'string',
        description: 'Custom WMS basemap URL. Default: OpenStreetMap',
      },
    },
    required: ['title'],
  },
};

const GENERATE_PORTAL_TOOL: Tool = {
  name: 'generate_portal',
  description: 'Generate a downloadable zip package containing the configured Masterportal. Call after adding layers with add_layer.',
  inputSchema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Output filename (without .zip extension). Default: auto-generated',
      },
    },
    required: [],
  },
};

export class MasterportalMCPServer {
  private server: Server;
  private sessionManager: SessionManager;
  private dataFetcher: DataFetcher;
  private zipBuilder: ZipBuilder;
  private currentSessionId: string = 'default';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'http://localhost:3000';

    this.server = new Server(
      {
        name: 'masterportal-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.sessionManager = new SessionManager();
    this.dataFetcher = new DataFetcher();
    this.zipBuilder = new ZipBuilder();

    this.setupHandlers();
  }

  setSessionId(sessionId: string): void {
    console.error(`[DEBUG] setSessionId called: ${sessionId}`);
    this.currentSessionId = sessionId;
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [ADD_LAYER_TOOL, CONFIGURE_MAP_TOOL, GENERATE_PORTAL_TOOL],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'add_layer':
          return await this.handleAddLayer(args as unknown as AddLayerParams);
        case 'configure_map':
          return await this.handleConfigureMap(args as unknown as ConfigureMapParams);
        case 'generate_portal':
          return await this.handleGeneratePortal(args as unknown as GeneratePortalParams);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleAddLayer(params: AddLayerParams) {
    console.error(`[DEBUG] handleAddLayer called with currentSessionId: ${this.currentSessionId}`);
    try {
      const { id, name, type, data, url, style } = params;

      if (!data && !url) {
        throw new Error('Either "data" (inline GeoJSON) or "url" must be provided');
      }

      let resolvedData;

      // Fetch or parse the data
      if (data) {
        resolvedData = this.dataFetcher.parseInlineGeoJSON(data);
      } else if (url) {
        if (type === 'geojson') {
          resolvedData = await this.dataFetcher.fetchGeoJSON(url);
        } else if (type === 'wfs') {
          resolvedData = await this.dataFetcher.fetchWFS(url);
        }
      }

      // Add layer to session
      this.sessionManager.addLayer(this.currentSessionId, {
        id,
        name,
        type,
        data,
        url,
        style,
        resolvedData,
      });

      const session = this.sessionManager.getSession(this.currentSessionId)!;
      const featureCount = resolvedData?.features?.length || 0;

      return {
        content: [
          {
            type: 'text',
            text: `Layer "${name}" added

Layer ID: ${id}
Type: ${type}
Features: ${featureCount}
Total layers: ${session.layers.length}

Use generate_portal when ready to create the zip package.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to add layer: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async handleConfigureMap(params: ConfigureMapParams) {
    try {
      const { title, center, zoom, basemap_url } = params;

      const config: any = { title };
      if (center) config.center = center as [number, number];
      if (zoom !== undefined) config.zoom = zoom;
      if (basemap_url) config.basemapUrl = basemap_url;

      this.sessionManager.updateMapConfig(this.currentSessionId, config);

      const session = this.sessionManager.getSession(this.currentSessionId)!;

      return {
        content: [
          {
            type: 'text',
            text: `Map configured

Title: ${session.mapConfig.title}
Center: [${session.mapConfig.center.join(', ')}]
Zoom: ${session.mapConfig.zoom}
Basemap: ${session.mapConfig.basemapUrl || 'OpenStreetMap (default)'}

Use generate_portal when ready to create the zip package.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to configure map: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async handleGeneratePortal(params: GeneratePortalParams) {
    console.error(`[DEBUG] handleGeneratePortal called with currentSessionId: ${this.currentSessionId}`);
    try {
      const session = this.sessionManager.getSession(this.currentSessionId);
      console.error(`[DEBUG] session exists: ${!!session}, layers: ${session?.layers?.length || 0}`);

      if (!session || session.layers.length === 0) {
        throw new Error('No layers added. Use add_layer first to add at least one layer.');
      }

      const download = await this.zipBuilder.buildZip(session, params.filename);
      const downloadUrl = `${this.baseUrl}/downloads/${download.filename}`;

      return {
        content: [
          {
            type: 'text',
            text: `Portal generated!

Download: ${downloadUrl}
Filename: ${download.filename}
Expires: ${download.expiresAt.toISOString()}

Portal details:
- Title: ${session.mapConfig.title}
- Layers: ${session.layers.length}
- Features: ${session.layers.reduce((sum, l) => sum + (l.resolvedData?.features?.length || 0), 0)}

Extract the zip to any web server to host your Masterportal.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to generate portal: ${error.message}` }],
        isError: true,
      };
    }
  }

  getZipBuilder(): ZipBuilder {
    return this.zipBuilder;
  }

  async connect(transport: any): Promise<void> {
    await this.server.connect(transport);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Masterportal MCP server running on stdio');
  }

  destroy(): void {
    this.sessionManager.destroy();
    this.zipBuilder.destroy();
  }
}

// CLI entry point
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const server = new MasterportalMCPServer();
  server.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
