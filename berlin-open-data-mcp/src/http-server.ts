#!/usr/bin/env node
// ABOUTME: HTTP server wrapper for Berlin Open Data MCP
// ABOUTME: Exposes the MCP server via Streamable HTTP transport for remote access

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { BerlinOpenDataMCPServer } from './index.js';

const PORT = process.env.PORT || 3000;

// Store MCP transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

/**
 * Strip full dataset JSON from fetch_dataset_data responses to prevent context overflow.
 * Keeps the preview (first JSON block), removes the full dataset (last JSON block).
 */
function stripFullDataFromResponse(responseBody: any): any {
  if (!responseBody || typeof responseBody !== 'object') {
    return responseBody;
  }

  if (responseBody.result && responseBody.result.content) {
    const content = responseBody.result.content;
    if (Array.isArray(content)) {
      responseBody.result.content = content.map((item: any) => {
        if (item.type === 'text' && typeof item.text === 'string') {
          if (item.text.includes('## Full Dataset Available') || item.text.includes('## Preview (first')) {
            const jsonMatches = Array.from(item.text.matchAll(/```json\n[\s\S]*?\n```/g));
            if (jsonMatches.length > 1) {
              const lastMatch = jsonMatches[jsonMatches.length - 1] as RegExpMatchArray;
              if (lastMatch.index !== undefined) {
                item.text = item.text.substring(0, lastMatch.index) +
                           item.text.substring(lastMatch.index + lastMatch[0].length);
                console.log('[bod-mcp] Stripped full data JSON from response');
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

async function main() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'bod-mcp' });
  });

  // MCP endpoint
  app.all('/mcp', async (req, res) => {
    console.log(`Received ${req.method} request to /mcp`);

    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            console.log(`MCP session initialized: ${sid}`);
            transports[sid] = newTransport;
          }
        });

        newTransport.onclose = () => {
          const sid = newTransport.sessionId;
          if (sid && transports[sid]) {
            console.log(`MCP session closed: ${sid}`);
            delete transports[sid];
          }
        };

        const mcpServer = new BerlinOpenDataMCPServer();
        await mcpServer.connect(newTransport);
        transport = newTransport;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }

      if (!transport) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error: transport not initialized' },
          id: null,
        });
        return;
      }

      // Intercept response to strip large data
      const originalWrite = res.write.bind(res);
      res.write = function(chunk: any, ...args: any[]) {
        let chunkStr: string;
        if (Buffer.isBuffer(chunk)) {
          chunkStr = chunk.toString('utf-8');
        } else if (typeof chunk === 'string') {
          chunkStr = chunk;
        } else {
          return originalWrite(chunk, ...args);
        }

        if (chunkStr.includes('data: ')) {
          const lines = chunkStr.split('\n');
          const modifiedLines = lines.map((line: string) => {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6);
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

        const outputChunk = Buffer.isBuffer(chunk) ? Buffer.from(chunkStr, 'utf-8') : chunkStr;
        return originalWrite(outputChunk, ...args);
      } as any;

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`Berlin Open Data MCP HTTP server running on port ${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

main().catch(console.error);
