// ABOUTME: Main Express server with WebSocket support
// ABOUTME: Initializes MCP client, Claude client, and serves frontend

import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPClientManager, findBerlinMCPPath } from './mcp-client.js';
import { ClaudeClient } from './claude-client.js';
import { WebSocketHandler } from './websocket-handler.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { BerlinOpenDataMCPServer } from '../../../berlin-open-data-mcp/dist/index.js';
import { randomUUID } from 'crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATAWRAPPER_API_KEY = process.env.DATAWRAPPER_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  try {
    console.log('Starting Interface Prototype Backend...');
    console.log('Environment check:');
    console.log('- ANTHROPIC_API_KEY:', ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
    console.log('- DATAWRAPPER_API_KEY:', DATAWRAPPER_API_KEY ? 'SET' : 'NOT SET');
    console.log('- All env keys:', Object.keys(process.env).filter(k => k.includes('DATAWRAPPER') || k.includes('API')).join(', '));

    // Initialize Berlin MCP client
    const berlinMCPPath = findBerlinMCPPath();
    console.log(`Using Berlin MCP server at: ${berlinMCPPath}`);

    const berlinMcpClient = new MCPClientManager({ serverPath: berlinMCPPath });
    await berlinMcpClient.connect();

    // Initialize Datawrapper MCP client (optional)
    let datawrapperMcpClient: MCPClientManager | undefined;
    if (DATAWRAPPER_API_KEY) {
      try {
        const datawrapperMCPPath = path.resolve(__dirname, '../../../datawrapper-mcp/dist/index.js');
        console.log(`Using Datawrapper MCP server at: ${datawrapperMCPPath}`);

        datawrapperMcpClient = new MCPClientManager({
          serverPath: datawrapperMCPPath,
          env: { DATAWRAPPER_API_TOKEN: DATAWRAPPER_API_KEY }
        });
        await datawrapperMcpClient.connect();
        console.log('Datawrapper MCP client connected successfully');
      } catch (error) {
        console.error('Failed to initialize Datawrapper MCP client:', error);
        console.warn('Continuing without visualization features');
        datawrapperMcpClient = undefined;
      }
    } else {
      console.warn('DATAWRAPPER_API_KEY not set - visualization features disabled');
    }

    // Initialize Claude client
    const claudeClient = new ClaudeClient(ANTHROPIC_API_KEY!);

    // Create Express app
    const app = express();
    app.use(express.json());
    const server = createServer(app);

    // Create WebSocket server
    const wss = new WebSocketServer({ server, path: '/ws' });

    // Create WebSocket handler with both MCP clients
    const wsHandler = new WebSocketHandler(berlinMcpClient, claudeClient, datawrapperMcpClient);

    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      wsHandler.handleConnection(ws);
    });

    // Store MCP transports by session ID
    const mcpTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    // Streamable HTTP MCP endpoint (supports GET, POST, DELETE)
    app.all('/mcp', async (req, res) => {
      console.log(`Received ${req.method} request to /mcp`);

      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId && mcpTransports[sessionId]) {
          // Reuse existing transport
          transport = mcpTransports[sessionId];
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport for initialization
          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              console.log(`MCP session initialized with ID: ${sid}`);
              mcpTransports[sid] = newTransport;
            }
          });

          // Clean up on close
          newTransport.onclose = () => {
            const sid = newTransport.sessionId;
            if (sid && mcpTransports[sid]) {
              console.log(`MCP session ${sid} closed`);
              delete mcpTransports[sid];
            }
          };

          // Connect to Berlin MCP server
          const mcpServer = new BerlinOpenDataMCPServer();
          await mcpServer.connect(newTransport);

          transport = newTransport;
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        if (!transport) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error: transport not initialized',
            },
            id: null,
          });
          return;
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Serve static files (production build of frontend)
    const frontendDistPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDistPath));

    // Catch-all route to serve index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });

    // Start server
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`WebSocket server listening on ws://localhost:${PORT}/ws`);
      console.log(`Connected to Berlin MCP server with ${berlinMcpClient.getTools().length} tools`);
      if (datawrapperMcpClient) {
        console.log(`Connected to Datawrapper MCP server with ${datawrapperMcpClient.getTools().length} tools`);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await berlinMcpClient.disconnect();
      if (datawrapperMcpClient) {
        await datawrapperMcpClient.disconnect();
      }
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
