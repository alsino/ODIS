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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  try {
    console.log('Starting Interface Prototype Backend...');

    // Initialize MCP client
    const berlinMCPPath = findBerlinMCPPath();
    console.log(`Using Berlin MCP server at: ${berlinMCPPath}`);

    const mcpClient = new MCPClientManager({ serverPath: berlinMCPPath });
    await mcpClient.connect();

    // Initialize Claude client
    const claudeClient = new ClaudeClient(ANTHROPIC_API_KEY!);

    // Create Express app
    const app = express();
    const server = createServer(app);

    // Create WebSocket server
    const wss = new WebSocketServer({ server, path: '/ws' });

    // Create WebSocket handler
    const wsHandler = new WebSocketHandler(mcpClient, claudeClient);

    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      wsHandler.handleConnection(ws);
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
      console.log(`Connected to Berlin MCP server with ${mcpClient.getTools().length} tools`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await mcpClient.disconnect();
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
