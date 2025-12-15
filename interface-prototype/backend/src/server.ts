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
import { DatawrapperMCPServer } from '../../../datawrapper-mcp/dist/index.js';
import { randomUUID } from 'crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Strip full dataset JSON from fetch_dataset_data responses to prevent context overflow.
 * Keeps the preview (first JSON block), removes the full dataset (last JSON block).
 * This matches the behavior in websocket-handler.ts
 */
function stripFullDataFromResponse(responseBody: any): any {
  if (!responseBody || typeof responseBody !== 'object') {
    return responseBody;
  }

  // Handle JSON-RPC response format
  if (responseBody.result && responseBody.result.content) {
    const content = responseBody.result.content;
    if (Array.isArray(content)) {
      responseBody.result.content = content.map((item: any) => {
        if (item.type === 'text' && typeof item.text === 'string') {
          // Check if this looks like a fetch_dataset_data response with full JSON
          if (item.text.includes('## Full Dataset Available') || item.text.includes('## Preview (first')) {
            // Find all JSON blocks
            const jsonMatches = Array.from(item.text.matchAll(/```json\n[\s\S]*?\n```/g));
            if (jsonMatches.length > 1) {
              // Remove the last JSON block (full data), keep preview
              const lastMatch = jsonMatches[jsonMatches.length - 1] as RegExpMatchArray;
              if (lastMatch.index !== undefined) {
                item.text = item.text.substring(0, lastMatch.index) +
                           item.text.substring(lastMatch.index + lastMatch[0].length);
                console.log('[/mcp] Stripped full data JSON from response');
              }
            }
          }
        }
        return item;
      });
    }
  }

  return responseBody;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATAWRAPPER_API_KEY = process.env.DATAWRAPPER_API_KEY;
const DATAWRAPPER_MCP_AUTH_TOKEN = process.env.DATAWRAPPER_MCP_AUTH_TOKEN;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  try {
    console.log('Starting Interface Prototype Backend...');

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
    const datawrapperMcpTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

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

        // Create a response interceptor to strip full data JSON
        // The transport uses SSE streaming with res.write(), so we intercept that
        const originalWrite = res.write.bind(res);
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        res.write = function(chunk: any, ...args: any[]) {
          // Convert Buffer to string if needed
          let chunkStr: string;
          if (Buffer.isBuffer(chunk)) {
            chunkStr = chunk.toString('utf-8');
          } else if (typeof chunk === 'string') {
            chunkStr = chunk;
          } else {
            return originalWrite(chunk, ...args);
          }

          if (chunkStr.includes('data: ')) {
            // SSE format: "data: {...}\n\n"
            const lines = chunkStr.split('\n');
            const modifiedLines = lines.map((line: string) => {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6); // Remove "data: " prefix
                  if (jsonStr.trim()) {
                    const parsed = JSON.parse(jsonStr);
                    const stripped = stripFullDataFromResponse(parsed);
                    return 'data: ' + JSON.stringify(stripped);
                  }
                } catch {
                  // Not valid JSON, pass through
                }
              }
              return line;
            });
            chunkStr = modifiedLines.join('\n');
          }

          // Convert back to Buffer if original was Buffer
          const outputChunk = Buffer.isBuffer(chunk) ? Buffer.from(chunkStr, 'utf-8') : chunkStr;
          return originalWrite(outputChunk, ...args);
        } as any;

        res.json = function(body: any) {
          return originalJson(stripFullDataFromResponse(body));
        };

        res.send = function(body: any) {
          if (typeof body === 'string') {
            try {
              const parsed = JSON.parse(body);
              return originalSend(JSON.stringify(stripFullDataFromResponse(parsed)));
            } catch {
              return originalSend(body);
            }
          }
          return originalSend(body);
        };

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

    // Streamable HTTP MCP endpoint for Datawrapper (with auth)
    app.all('/datawrapper-mcp', async (req, res) => {
      console.log(`Received ${req.method} request to /datawrapper-mcp`);

      // Check authentication
      if (DATAWRAPPER_MCP_AUTH_TOKEN) {
        const authHeader = req.headers['authorization'];
        const expectedToken = `Bearer ${DATAWRAPPER_MCP_AUTH_TOKEN}`;

        if (!authHeader || authHeader !== expectedToken) {
          console.log('Unauthorized request to /datawrapper-mcp');
          res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Unauthorized: Invalid or missing authentication token',
            },
            id: null,
          });
          return;
        }
      } else {
        console.warn('Warning: DATAWRAPPER_MCP_AUTH_TOKEN not set - endpoint is unprotected');
      }

      // Check if DATAWRAPPER_API_KEY is configured
      if (!DATAWRAPPER_API_KEY) {
        res.status(503).json({
          jsonrpc: '2.0',
          error: {
            code: -32002,
            message: 'Service unavailable: Datawrapper API not configured',
          },
          id: null,
        });
        return;
      }

      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId && datawrapperMcpTransports[sessionId]) {
          // Reuse existing transport
          transport = datawrapperMcpTransports[sessionId];
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport for initialization
          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              console.log(`Datawrapper MCP session initialized with ID: ${sid}`);
              datawrapperMcpTransports[sid] = newTransport;
            }
          });

          // Clean up on close
          newTransport.onclose = () => {
            const sid = newTransport.sessionId;
            if (sid && datawrapperMcpTransports[sid]) {
              console.log(`Datawrapper MCP session ${sid} closed`);
              delete datawrapperMcpTransports[sid];
            }
          };

          // Connect to Datawrapper MCP server
          const mcpServer = new DatawrapperMCPServer(DATAWRAPPER_API_KEY);
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
        console.error('Error handling Datawrapper MCP request:', error);
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
      console.log(`Berlin MCP endpoint available at /mcp`);
      if (DATAWRAPPER_API_KEY) {
        console.log(`Datawrapper MCP endpoint available at /datawrapper-mcp${DATAWRAPPER_MCP_AUTH_TOKEN ? ' (auth required)' : ' (no auth)'}`);
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
