# Interface Prototype - Implementation Plan

## Overview

This plan details the step-by-step implementation of a web-based chat interface that connects to the Berlin Open Data MCP server via the Model Context Protocol, orchestrated by Claude AI. The implementation follows a phased approach with frequent commits, test-driven development, and clear verification steps at each stage.

---

## Prerequisites

**Required knowledge:**
- TypeScript/Node.js development
- Basic frontend development (HTML/CSS/JavaScript)
- WebSocket communication basics
- Understanding of async/await patterns
- Git version control

**Tools & libraries to be used:**
- `@modelcontextprotocol/sdk` - MCP client SDK
- `@anthropic-ai/sdk` - Claude API client
- `express` - Web server framework
- `ws` - WebSocket library for Node.js
- `svelte` - Frontend framework
- `vite` - Frontend build tool
- `typescript` - Type safety
- `tsx` - Development runtime for TypeScript

**Context you need:**
- Read `../design-spec.md` - Complete design specification
- Read `../../berlin-open-data-mcp/README.md` - Understand the MCP server we're connecting to
- Familiarize yourself with MCP protocol: https://modelcontextprotocol.io/
- Review Claude API docs: https://docs.anthropic.com/

---

## Design Principles

1. **YAGNI (You Aren't Gonna Need It)**: Build only what's specified, no premature features
2. **DRY (Don't Repeat Yourself)**: Extract common patterns into reusable functions
3. **TDD (Test-Driven Development)**: Write tests before or immediately after implementation
4. **Frequent commits**: Commit after each completed task with descriptive messages
5. **Keep it simple**: Prefer readable code over clever solutions
6. **ABOUTME comments**: All code files MUST start with 2-line ABOUTME comments

---

## Project Structure

```
interface-prototype/
├── docs/
│   └── plans/
│       ├── design-spec.md
│       └── implementation-plan.md (this file)
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── mcp-client.ts
│   │   ├── claude-client.ts
│   │   ├── websocket-handler.ts
│   │   └── types.ts
│   ├── test/
│   │   ├── mcp-client.test.ts
│   │   ├── claude-client.test.ts
│   │   └── integration.test.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.svelte
│   │   ├── lib/
│   │   │   ├── Chat.svelte
│   │   │   ├── Message.svelte
│   │   │   ├── Input.svelte
│   │   │   └── ToolActivity.svelte
│   │   ├── main.js
│   │   └── app.css
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── package.json (workspace root)
├── .gitignore
└── README.md
```

---

## Phase 0: Project Setup

**Goal:** Initialize the project structure with all necessary configuration files and dependencies.

### Task 0.1: Create Root Package.json (Workspace)

**What to do:** Set up npm workspaces to manage backend and frontend together.

**Files to create:**
- `/interface-prototype/package.json`

**Step-by-step:**

1. **Create the workspace package.json:**

```json
{
  "name": "interface-prototype",
  "version": "1.0.0",
  "description": "Web interface for Berlin Open Data MCP server",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "install-all": "npm install",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "build": "npm run build:backend && npm run build:frontend",
    "test": "npm test --workspaces"
  },
  "keywords": ["mcp", "berlin", "open-data", "chat"],
  "author": "",
  "license": "MIT"
}
```

2. **Create .gitignore:**

```
node_modules/
dist/
build/
.env
*.log
.DS_Store
```

**How to test:**
```bash
cd interface-prototype
npm install
```

**Expected output:** No errors, creates `node_modules/` and `package-lock.json`

**Commit message:** `Initialize workspace with npm workspaces configuration`

---

### Task 0.2: Set Up Backend Package

**What to do:** Create backend directory structure and package.json with all dependencies.

**Files to create:**
- `/interface-prototype/backend/package.json`
- `/interface-prototype/backend/tsconfig.json`

**Step-by-step:**

1. **Create backend directory:**
```bash
mkdir -p backend/src backend/test
```

2. **Create backend/package.json:**

```json
{
  "name": "interface-prototype-backend",
  "version": "1.0.0",
  "description": "Backend server for interface prototype",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/server.ts",
    "start": "node dist/server.js",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.21.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.14",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.14"
  }
}
```

3. **Create backend/tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**How to test:**
```bash
cd backend
npm install
npm run build
```

**Expected output:** Creates `dist/` directory, no TypeScript errors

**Commit message:** `Add backend package with TypeScript configuration`

---

### Task 0.3: Set Up Frontend Package

**What to do:** Create frontend directory with Svelte + Vite setup.

**Files to create:**
- `/interface-prototype/frontend/package.json`
- `/interface-prototype/frontend/vite.config.js`
- `/interface-prototype/frontend/index.html`

**Step-by-step:**

1. **Create frontend directory:**
```bash
mkdir -p frontend/src/lib frontend/public
```

2. **Create frontend/package.json:**

```json
{
  "name": "interface-prototype-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "svelte": "^4.2.19"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "vite": "^5.0.0"
  }
}
```

3. **Create frontend/vite.config.js:**

```javascript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
```

4. **Create frontend/index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Berlin Open Data Chat</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

**How to test:**
```bash
cd frontend
npm install
```

**Expected output:** Dependencies installed successfully

**Commit message:** `Add frontend package with Svelte and Vite configuration`

---

### Task 0.4: Create Root README

**What to do:** Document how to run the project.

**Files to create:**
- `/interface-prototype/README.md`

**Step-by-step:**

1. **Create README.md:**

```markdown
# Interface Prototype

Web-based chat interface for the Berlin Open Data MCP server.

## Architecture

- **Frontend**: Svelte + Vite chat UI (port 5173)
- **Backend**: Node.js/Express + WebSocket server (port 3000)
- **MCP Server**: Berlin Open Data MCP (spawned by backend)
- **AI**: Claude API for conversation orchestration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your Claude API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

3. Build the Berlin MCP server (if not already built):
```bash
cd ../berlin-open-data-mcp
npm install
npm run build
cd ../interface-prototype
```

## Development

Start backend and frontend in separate terminals:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

Open browser to http://localhost:5173

## Production Build

```bash
npm run build
npm start
```

## Project Structure

- `backend/` - Express server, MCP client, Claude API integration
- `frontend/` - Svelte chat interface
- `docs/plans/` - Design spec and implementation plan

## How It Works

1. User types message in web UI
2. Frontend sends via WebSocket to backend
3. Backend forwards to Claude API with available MCP tools
4. Claude decides which tools to call
5. Backend executes tools via Berlin MCP server
6. Backend sends results back to Claude
7. Claude generates final response
8. Backend streams response to frontend
9. Frontend displays response in chat

## Testing

```bash
npm test
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required. Your Claude API key
- `PORT` - Optional. Backend port (default: 3000)
- `BERLIN_MCP_PATH` - Optional. Path to Berlin MCP server
```

**Commit message:** `Add root README with setup instructions`

---

### Phase 0 Complete!

**Verification checklist:**
- [ ] Workspace package.json exists with workspaces configured
- [ ] Backend package.json has all required dependencies
- [ ] Frontend package.json has Svelte and Vite
- [ ] TypeScript configs are correct
- [ ] .gitignore is in place
- [ ] README explains how to run the project
- [ ] All directories created: backend/src, backend/test, frontend/src/lib
- [ ] `npm install` works in root directory

**Total commits:** 4

---

## Phase 1: Backend MCP Client

**Goal:** Create a working MCP client that can connect to the Berlin Open Data MCP server and execute tools.

### Task 1.1: Create Type Definitions

**What to do:** Define TypeScript interfaces for messages, tools, and configuration.

**Files to create:**
- `/interface-prototype/backend/src/types.ts`

**Step-by-step:**

1. **Create backend/src/types.ts:**

```typescript
// ABOUTME: Type definitions for MCP client, WebSocket messages, and Claude API
// ABOUTME: Provides type safety across the backend application

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// WebSocket message types
export interface UserMessage {
  type: 'user_message';
  content: string;
}

export interface AssistantMessage {
  type: 'assistant_message';
  content: string;
  done: boolean;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

export interface StatusMessage {
  type: 'status';
  status: string;
}

/**
 * Sent when a tool execution begins
 * Allows frontend to display real-time spinner/status indicator
 */
export interface ToolCallStart {
  type: 'tool_call_start';
  toolCallId: string;  // Unique ID to track this specific tool call
  toolName: string;    // Name of the MCP tool being executed
  toolArgs: any;       // Arguments passed to the tool
}

/**
 * Sent when a tool execution completes (successfully or with error)
 * Frontend uses this to update the tool display with results
 */
export interface ToolCallComplete {
  type: 'tool_call_complete';
  toolCallId: string;  // Matches the ID from ToolCallStart
  toolName: string;    // Name of the tool that completed
  result: string;      // Result text or error message
  isError?: boolean;   // True if tool execution failed
}

export type WebSocketMessage = UserMessage | AssistantMessage | ErrorMessage | StatusMessage | ToolCallStart | ToolCallComplete;

// Conversation history
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

// MCP configuration
export interface MCPConfig {
  serverPath: string;
  serverArgs?: string[];
}

// Tool execution result
export interface ToolResult {
  toolUseId: string;
  content: any;
  isError?: boolean;
}
```

**How to test:**
```bash
cd backend
npm run build
```

**Expected output:** Compiles without errors

**Commit message:** `Add TypeScript type definitions for backend`

---

### Task 1.2: Create MCP Client Module

**What to do:** Build a class that manages connection to the Berlin MCP server and provides tool execution methods.

**Files to create:**
- `/interface-prototype/backend/src/mcp-client.ts`

**Step-by-step:**

1. **Create backend/src/mcp-client.ts:**

```typescript
// ABOUTME: MCP client that connects to Berlin Open Data MCP server
// ABOUTME: Handles server spawning, tool discovery, and tool execution

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { MCPConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPClientManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: ChildProcess | null = null;
  private tools: Tool[] = [];
  private isConnected = false;

  constructor(private config: MCPConfig) {}

  /**
   * Start the MCP server and connect to it
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('MCP client already connected');
      return;
    }

    try {
      console.log('Starting Berlin MCP server...');
      console.log('Server path:', this.config.serverPath);

      // Spawn the MCP server as a child process
      this.process = spawn('node', [this.config.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // Log server errors
      this.process.stderr?.on('data', (data) => {
        console.error('MCP Server Error:', data.toString());
      });

      // Handle server exit
      this.process.on('exit', (code) => {
        console.log(`MCP server exited with code ${code}`);
        this.isConnected = false;
      });

      // Create transport using stdio
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [this.config.serverPath]
      });

      // Create and connect MCP client
      this.client = new Client(
        {
          name: 'interface-prototype-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await this.client.connect(this.transport);

      this.isConnected = true;
      console.log('Connected to Berlin MCP server');

      // Fetch available tools
      await this.refreshTools();

    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch available tools from the MCP server
   */
  async refreshTools(): Promise<Tool[]> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client.listTools();
      this.tools = response.tools;
      console.log(`Loaded ${this.tools.length} tools from Berlin MCP server`);
      return this.tools;
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      throw error;
    }
  }

  /**
   * Get list of available tools
   */
  getTools(): Tool[] {
    return this.tools;
  }

  /**
   * Execute a tool
   */
  async callTool(name: string, args: any): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`Executing tool: ${name}`, JSON.stringify(args, null, 2));

      const result = await this.client.callTool({
        name,
        arguments: args
      });

      console.log(`Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      console.error(`Tool execution failed for ${name}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.isConnected = false;
    console.log('Disconnected from MCP server');
  }

  /**
   * Check if connected
   */
  connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Helper function to find Berlin MCP server path
 */
export function findBerlinMCPPath(): string {
  // Try environment variable first
  if (process.env.BERLIN_MCP_PATH) {
    return process.env.BERLIN_MCP_PATH;
  }

  // Default: assume it's in ../berlin-open-data-mcp/dist/index.js
  const defaultPath = path.resolve(__dirname, '../../../berlin-open-data-mcp/dist/index.js');
  return defaultPath;
}
```

**How to test:**

Create a test file `backend/test/mcp-client.test.ts`:

```typescript
import { MCPClientManager, findBerlinMCPPath } from '../src/mcp-client.js';

describe('MCPClientManager', () => {
  let client: MCPClientManager;

  beforeAll(async () => {
    const serverPath = findBerlinMCPPath();
    client = new MCPClientManager({ serverPath });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test('should connect to MCP server', () => {
    expect(client.connected()).toBe(true);
  });

  test('should fetch tools', async () => {
    const tools = client.getTools();
    expect(tools.length).toBeGreaterThan(0);

    // Check for expected tools
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('search_berlin_datasets');
    expect(toolNames).toContain('get_dataset_details');
    expect(toolNames).toContain('fetch_dataset_data');
  });

  test('should execute search tool', async () => {
    const result = await client.callTool('search_berlin_datasets', {
      query: 'traffic',
      limit: 5
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  }, 10000); // 10 second timeout for API call
});
```

**Run tests:**
```bash
cd backend
npm test
```

**Expected output:** All tests pass

**Commit message:** `Add MCP client manager with connection and tool execution`

---

### Task 1.3: Create Claude API Client

**What to do:** Build a module that handles Claude API communication with tool support.

**Files to create:**
- `/interface-prototype/backend/src/claude-client.ts`

**Step-by-step:**

1. **Create backend/src/claude-client.ts:**

```typescript
// ABOUTME: Claude API client that handles conversation and tool calling
// ABOUTME: Manages message history and streaming responses

import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ConversationMessage } from './types.js';

export interface ClaudeResponse {
  content: string;
  toolCalls?: ToolCall[];
  stopReason: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export class ClaudeClient {
  private client: Anthropic;
  private model = 'claude-3-5-sonnet-20241022';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Send a message to Claude with available tools
   * Returns response which may include tool calls
   */
  async sendMessage(
    messages: ConversationMessage[],
    tools: Tool[]
  ): Promise<ClaudeResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: messages as any,
        tools: tools as any
      });

      // Extract text content
      const textContent = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      // Extract tool calls
      const toolCalls = response.content
        .filter((block: any) => block.type === 'tool_use')
        .map((block: any) => ({
          id: block.id,
          name: block.name,
          input: block.input
        }));

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        stopReason: response.stop_reason
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  /**
   * Send message and handle tool calling loop
   * Executes tools via provided callback and continues until final response
   */
  async sendMessageWithTools(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    tools: Tool[],
    executeToolCallback: (name: string, args: any) => Promise<any>
  ): Promise<string> {
    // Add user message to history
    const messages: ConversationMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    let finalResponse = '';
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.sendMessage(messages, tools);

      // If no tool calls, we have final response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalResponse = response.content;
        break;
      }

      // Execute tool calls
      console.log(`Claude requested ${response.toolCalls.length} tool calls`);

      // Add assistant's tool use to history
      const toolUseContent = response.toolCalls.map(tc => ({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input
      }));

      messages.push({
        role: 'assistant',
        content: toolUseContent
      });

      // Execute tools and collect results
      const toolResults = [];
      for (const toolCall of response.toolCalls) {
        try {
          const result = await executeToolCallback(toolCall.name, toolCall.input);

          // Extract text from MCP result
          let resultText = '';
          if (result.content && Array.isArray(result.content)) {
            resultText = result.content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join('\n');
          } else if (typeof result === 'string') {
            resultText = result;
          } else {
            resultText = JSON.stringify(result);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: resultText
          });
        } catch (error) {
          console.error(`Tool execution error for ${toolCall.name}:`, error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true
          });
        }
      }

      // Add tool results to history
      messages.push({
        role: 'user',
        content: toolResults
      });
    }

    if (iterations >= maxIterations) {
      console.warn('Max tool calling iterations reached');
      finalResponse = finalResponse || 'I apologize, but I encountered too many tool calls. Please try rephrasing your question.';
    }

    return finalResponse;
  }
}
```

**How to test:**

Create `backend/test/claude-client.test.ts`:

```typescript
import { ClaudeClient } from '../src/claude-client.js';

// Skip if no API key
const apiKey = process.env.ANTHROPIC_API_KEY;
const describeOrSkip = apiKey ? describe : describe.skip;

describeOrSkip('ClaudeClient', () => {
  let client: ClaudeClient;

  beforeAll(() => {
    client = new ClaudeClient(apiKey!);
  });

  test('should send simple message', async () => {
    const response = await client.sendMessage(
      [{ role: 'user', content: 'Say hello' }],
      []
    );

    expect(response.content).toBeDefined();
    expect(response.content.toLowerCase()).toContain('hello');
  }, 30000);

  test('should handle tool calls', async () => {
    const mockTool = {
      name: 'get_weather',
      description: 'Get weather for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    };

    const response = await client.sendMessage(
      [{ role: 'user', content: 'What is the weather in Berlin?' }],
      [mockTool as any]
    );

    // Claude should request the weather tool
    expect(response.toolCalls).toBeDefined();
    if (response.toolCalls && response.toolCalls.length > 0) {
      expect(response.toolCalls[0].name).toBe('get_weather');
    }
  }, 30000);
});
```

**Run tests:**
```bash
export ANTHROPIC_API_KEY=your-key-here
npm test
```

**Commit message:** `Add Claude API client with tool calling support`

---

### Phase 1 Complete!

**Verification checklist:**
- [ ] Type definitions compile correctly
- [ ] MCP client can connect to Berlin server
- [ ] MCP client can fetch and execute tools
- [ ] Claude client can send messages
- [ ] Claude client can handle tool calling loop
- [ ] All tests pass
- [ ] Code has ABOUTME comments

**Total commits:** 3 (types, mcp-client, claude-client)

---

## Phase 2: Backend WebSocket Server

**Goal:** Create Express server with WebSocket support that connects frontend to MCP/Claude.

### Task 2.1: Create WebSocket Handler

**What to do:** Build WebSocket message handler that processes user messages and streams responses.

**Files to create:**
- `/interface-prototype/backend/src/websocket-handler.ts`

**Step-by-step:**

1. **Create backend/src/websocket-handler.ts:**

```typescript
// ABOUTME: WebSocket handler for real-time communication with frontend
// ABOUTME: Processes user messages and streams Claude responses back

import type { WebSocket } from 'ws';
import type { MCPClientManager } from './mcp-client.js';
import type { ClaudeClient } from './claude-client.js';
import type { ConversationMessage, WebSocketMessage, UserMessage } from './types.js';

export class WebSocketHandler {
  private conversationHistory: Map<WebSocket, ConversationMessage[]> = new Map();

  constructor(
    private mcpClient: MCPClientManager,
    private claudeClient: ClaudeClient
  ) {}

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket): void {
    console.log('New WebSocket connection');

    // Initialize conversation history for this connection
    this.conversationHistory.set(ws, []);

    // Send welcome message
    this.sendMessage(ws, {
      type: 'status',
      status: 'Connected to Berlin Open Data Chat'
    });

    // Set up message handler
    ws.on('message', async (data: Buffer) => {
      await this.handleMessage(ws, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.conversationHistory.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Handle incoming message from frontend
   */
  private async handleMessage(ws: WebSocket, data: Buffer): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      if (message.type === 'user_message') {
        await this.handleUserMessage(ws, message);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendMessage(ws, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process user message and get Claude response
   */
  private async handleUserMessage(ws: WebSocket, message: UserMessage): Promise<void> {
    const { content } = message;
    const history = this.conversationHistory.get(ws) || [];

    try {
      // Get available tools from MCP
      const tools = this.mcpClient.getTools();

      // Send to Claude with tool execution callback
      const response = await this.claudeClient.sendMessageWithTools(
        content,
        history,
        tools,
        async (toolName: string, toolArgs: any) => {
          // Execute tool via MCP client
          return await this.mcpClient.callTool(toolName, toolArgs);
        }
      );

      // Update conversation history
      history.push({ role: 'user', content });
      history.push({ role: 'assistant', content: response });
      this.conversationHistory.set(ws, history);

      // Send response to frontend
      this.sendMessage(ws, {
        type: 'assistant_message',
        content: response,
        done: true
      });

    } catch (error) {
      console.error('Error processing user message:', error);
      this.sendMessage(ws, {
        type: 'error',
        error: `Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
```

**Commit message:** `Add WebSocket handler for user message processing`

---

### Task 2.2: Create Express Server

**What to do:** Build main server that ties everything together.

**Files to create:**
- `/interface-prototype/backend/src/server.ts`

**Step-by-step:**

1. **Create backend/src/server.ts:**

```typescript
// ABOUTME: Main Express server with WebSocket support
// ABOUTME: Initializes MCP client, Claude client, and serves frontend

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
    const claudeClient = new ClaudeClient(ANTHROPIC_API_KEY);

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
```

**How to test:**

1. Build the backend:
```bash
cd backend
npm run build
```

2. Build the Berlin MCP server (if not already):
```bash
cd ../../berlin-open-data-mcp
npm run build
cd ../interface-prototype
```

3. Start the server:
```bash
export ANTHROPIC_API_KEY=your-key-here
npm run dev:backend
```

**Expected output:**
```
Starting Interface Prototype Backend...
Using Berlin MCP server at: /path/to/berlin-open-data-mcp/dist/index.js
Starting Berlin MCP server...
Connected to Berlin MCP server
Loaded 5 tools from Berlin MCP server
Server running on http://localhost:3000
WebSocket server listening on ws://localhost:3000/ws
Connected to Berlin MCP server with 5 tools
```

**Commit message:** `Add Express server with WebSocket and MCP integration`

---

### Phase 2 Complete!

**Verification checklist:**
- [ ] Server starts without errors
- [ ] MCP client connects to Berlin server
- [ ] WebSocket server is running
- [ ] Server can handle graceful shutdown
- [ ] All ABOUTME comments present

**Total commits:** 2 (websocket-handler, server)

---

## Phase 3: Frontend Chat Interface

**Goal:** Create Svelte chat UI that connects to backend via WebSocket.

### Task 3.1: Create Basic Svelte Components

**What to do:** Build the core UI components (Message, Input, Chat, App).

**Files to create:**
- `/interface-prototype/frontend/src/lib/Message.svelte`
- `/interface-prototype/frontend/src/lib/Input.svelte`
- `/interface-prototype/frontend/src/lib/Chat.svelte`
- `/interface-prototype/frontend/src/App.svelte`
- `/interface-prototype/frontend/src/main.js`
- `/interface-prototype/frontend/src/app.css`

**Step-by-step:**

1. **Create frontend/src/lib/Message.svelte:**

```svelte
<!-- ABOUTME: Individual message bubble component -->
<!-- ABOUTME: Displays user or assistant messages with appropriate styling -->

<script>
  export let role = 'user'; // 'user' or 'assistant'
  export let content = '';
</script>

<div class="message {role}">
  <div class="message-role">{role === 'user' ? 'You' : 'Assistant'}</div>
  <div class="message-content">{content}</div>
</div>

<style>
  .message {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    max-width: 80%;
  }

  .message.user {
    background-color: #e3f2fd;
    margin-left: auto;
    text-align: right;
  }

  .message.assistant {
    background-color: #f5f5f5;
    margin-right: auto;
  }

  .message-role {
    font-size: 0.75rem;
    font-weight: 600;
    color: #666;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
  }

  .message-content {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
```

2. **Create frontend/src/lib/Input.svelte:**

```svelte
<!-- ABOUTME: Message input component with send button -->
<!-- ABOUTME: Handles user input and sends messages to parent -->

<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let inputValue = '';
  let disabled = false;

  export { disabled };

  function handleSubmit(e) {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      dispatch('send', { message: inputValue.trim() });
      inputValue = '';
    }
  }

  function handleKeyDown(e) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }
</script>

<form class="input-container" on:submit={handleSubmit}>
  <textarea
    bind:value={inputValue}
    on:keydown={handleKeyDown}
    placeholder="Type your message..."
    {disabled}
    rows="1"
  />
  <button type="submit" disabled={!inputValue.trim() || disabled}>
    Send
  </button>
</form>

<style>
  .input-container {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #ddd;
    background: white;
  }

  textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
    resize: none;
    min-height: 44px;
    max-height: 200px;
  }

  textarea:focus {
    outline: none;
    border-color: #1976d2;
  }

  textarea:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  button {
    padding: 0.75rem 1.5rem;
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: #1565c0;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
</style>
```

3. **Create frontend/src/lib/Chat.svelte:**

```svelte
<!-- ABOUTME: Main chat container component -->
<!-- ABOUTME: Manages WebSocket connection and displays message history -->

<script>
  import { onMount, onDestroy } from 'svelte';
  import Message from './Message.svelte';
  import Input from './Input.svelte';

  let messages = [];
  let ws = null;
  let connected = false;
  let waiting = false;
  let error = null;

  onMount(() => {
    connectWebSocket();
  });

  onDestroy(() => {
    if (ws) {
      ws.close();
    }
  });

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      connected = true;
      error = null;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      error = 'Connection error';
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      connected = false;

      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!connected) {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }
      }, 3000);
    };
  }

  function handleMessage(data) {
    console.log('Received message:', data);

    if (data.type === 'status') {
      console.log('Status:', data.status);
    } else if (data.type === 'assistant_message') {
      messages = [...messages, { role: 'assistant', content: data.content }];
      waiting = false;
    } else if (data.type === 'error') {
      error = data.error;
      waiting = false;
    }
  }

  function handleSend(event) {
    const userMessage = event.detail.message;

    // Add user message to UI
    messages = [...messages, { role: 'user', content: userMessage }];
    waiting = true;
    error = null;

    // Send to backend
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'user_message',
        content: userMessage
      }));
    } else {
      error = 'Not connected to server';
      waiting = false;
    }
  }

  // Auto-scroll to bottom when new messages arrive
  let chatContainer;
  $: if (messages.length && chatContainer) {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 0);
  }
</script>

<div class="chat-container">
  <div class="chat-header">
    <h1>Berlin Open Data Chat</h1>
    <div class="status">
      {#if connected}
        <span class="status-dot connected"></span>
        Connected
      {:else}
        <span class="status-dot disconnected"></span>
        Disconnected
      {/if}
    </div>
  </div>

  <div class="messages" bind:this={chatContainer}>
    {#if messages.length === 0}
      <div class="welcome">
        <h2>Welcome to Berlin Open Data Chat</h2>
        <p>Find and ask questions about Berlin's open datasets. For example:</p>
        <ul>
          <li>"Find datasets about traffic"</li>
          <li>"What data is available about housing?"</li>
          <li>"Show me air quality datasets"</li>
        </ul>
      </div>
    {/if}

    {#each messages as message}
      <Message role={message.role} content={message.content} />
    {/each}

    {#if waiting}
      <div class="loading">Assistant is thinking...</div>
    {/if}

    {#if error}
      <div class="error-message">Error: {error}</div>
    {/if}
  </div>

  <Input on:send={handleSend} disabled={!connected || waiting} />
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 2px solid #1976d2;
    background: #1976d2;
    color: white;
  }

  .chat-header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.connected {
    background-color: #4caf50;
  }

  .status-dot.disconnected {
    background-color: #f44336;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
  }

  .welcome {
    text-align: center;
    color: #666;
    margin: auto;
    max-width: 600px;
  }

  .welcome h2 {
    color: #333;
    margin-bottom: 1rem;
  }

  .welcome ul {
    text-align: left;
    display: inline-block;
  }

  .welcome li {
    margin: 0.5rem 0;
    font-style: italic;
  }

  .loading {
    padding: 0.75rem 1rem;
    background-color: #f5f5f5;
    border-radius: 8px;
    color: #666;
    font-style: italic;
    max-width: 80%;
  }

  .error-message {
    padding: 0.75rem 1rem;
    background-color: #ffebee;
    border: 1px solid #f44336;
    border-radius: 8px;
    color: #c62828;
    max-width: 80%;
  }
</style>
```

4. **Create frontend/src/App.svelte:**

```svelte
<!-- ABOUTME: Root application component -->
<!-- ABOUTME: Wraps the main Chat component -->

<script>
  import Chat from './lib/Chat.svelte';
</script>

<main>
  <Chat />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
  }

  main {
    width: 100%;
    height: 100vh;
  }
</style>
```

5. **Create frontend/src/main.js:**

```javascript
// ABOUTME: Frontend entry point
// ABOUTME: Initializes the Svelte application

import './app.css';
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app')
});

export default app;
```

6. **Create frontend/src/app.css:**

```css
/* ABOUTME: Global styles for the application */

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

#app {
  height: 100%;
}
```

**How to test:**

1. Start the backend (in one terminal):
```bash
cd backend
export ANTHROPIC_API_KEY=your-key-here
npm run dev
```

2. Start the frontend (in another terminal):
```bash
cd frontend
npm run dev
```

3. Open browser to `http://localhost:5173`

**Expected behavior:**
- Chat interface loads
- Status shows "Connected"
- Can type messages
- Messages appear in chat history
- Assistant responds (via Claude API + Berlin MCP)

**Commit message:** `Add Svelte frontend with chat interface and WebSocket connection`

---

### Phase 3 Complete!

**Verification checklist:**
- [ ] Frontend builds without errors
- [ ] Chat interface renders correctly
- [ ] WebSocket connects to backend
- [ ] Can send messages
- [ ] Messages appear in chat
- [ ] Assistant responses work
- [ ] Loading indicator shows while waiting
- [ ] Error messages display correctly
- [ ] Auto-scroll works

**Total commits:** 1 (all frontend components together)

---

## Phase 4: Integration Testing & Documentation

**Goal:** Test end-to-end workflows and document the complete system.

### Task 4.1: Create Integration Tests

**What to do:** Write tests for complete user workflows.

**Files to create:**
- `/interface-prototype/backend/test/integration.test.ts`

**Step-by-step:**

1. **Create backend/test/integration.test.ts:**

```typescript
// ABOUTME: Integration tests for complete workflows
// ABOUTME: Tests MCP client + Claude client + WebSocket handler together

import { MCPClientManager, findBerlinMCPPath } from '../src/mcp-client.js';
import { ClaudeClient } from '../src/claude-client.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const describeOrSkip = apiKey ? describe : describe.skip;

describeOrSkip('End-to-end Integration', () => {
  let mcpClient: MCPClientManager;
  let claudeClient: ClaudeClient;

  beforeAll(async () => {
    // Set up MCP client
    const serverPath = findBerlinMCPPath();
    mcpClient = new MCPClientManager({ serverPath });
    await mcpClient.connect();

    // Set up Claude client
    claudeClient = new ClaudeClient(apiKey!);
  }, 30000);

  afterAll(async () => {
    await mcpClient.disconnect();
  });

  test('should handle search workflow', async () => {
    const tools = mcpClient.getTools();
    const response = await claudeClient.sendMessageWithTools(
      'Find datasets about traffic in Berlin',
      [],
      tools,
      async (name, args) => await mcpClient.callTool(name, args)
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(0);
    expect(response.toLowerCase()).toContain('dataset');
  }, 60000);

  test('should handle multi-step workflow', async () => {
    const tools = mcpClient.getTools();
    const conversationHistory = [];

    // First message: search
    const response1 = await claudeClient.sendMessageWithTools(
      'Find traffic datasets',
      conversationHistory,
      tools,
      async (name, args) => await mcpClient.callTool(name, args)
    );

    conversationHistory.push(
      { role: 'user', content: 'Find traffic datasets' },
      { role: 'assistant', content: response1 }
    );

    expect(response1).toBeDefined();

    // Second message: ask about the first result
    const response2 = await claudeClient.sendMessageWithTools(
      'Tell me more about the first dataset',
      conversationHistory,
      tools,
      async (name, args) => await mcpClient.callTool(name, args)
    );

    expect(response2).toBeDefined();
    expect(response2.length).toBeGreaterThan(0);
  }, 120000);

  test('should handle portal stats query', async () => {
    const tools = mcpClient.getTools();
    const response = await claudeClient.sendMessageWithTools(
      'How many datasets are in the Berlin Open Data Portal?',
      [],
      tools,
      async (name, args) => await mcpClient.callTool(name, args)
    );

    expect(response).toBeDefined();
    expect(response).toMatch(/\d+/); // Should contain numbers
  }, 60000);
});
```

**Run tests:**
```bash
cd backend
export ANTHROPIC_API_KEY=your-key-here
npm test
```

**Commit message:** `Add integration tests for end-to-end workflows`

---

### Task 4.2: Update Documentation

**What to do:** Finalize README with complete setup and usage instructions.

**Files to modify:**
- `/interface-prototype/README.md`

**Step-by-step:**

1. **Enhance the existing README with more details:**

Add these sections:

```markdown
## Architecture Details

### Backend Components

1. **server.ts** - Main Express server
   - Spawns Berlin MCP server as child process
   - Creates WebSocket server on `/ws` endpoint
   - Serves compiled frontend in production

2. **mcp-client.ts** - MCP Client Manager
   - Connects to Berlin MCP via stdio transport
   - Fetches available tools on startup
   - Executes tool calls requested by Claude

3. **claude-client.ts** - Claude API Integration
   - Sends messages with tool definitions
   - Handles tool calling loop (multiple iterations)
   - Manages conversation history

4. **websocket-handler.ts** - WebSocket Message Handler
   - Processes incoming user messages
   - Coordinates between Claude and MCP
   - Streams responses back to frontend

### Frontend Components

1. **Chat.svelte** - Main container
   - Manages WebSocket connection
   - Displays message history
   - Handles reconnection logic

2. **Message.svelte** - Message bubble
   - Renders user/assistant messages
   - Applies appropriate styling

3. **Input.svelte** - Message input
   - Text area with send button
   - Enter to send, Shift+Enter for new line

## Message Flow

```
User types message
    ↓
Frontend sends via WebSocket: {"type": "user_message", "content": "..."}
    ↓
Backend receives message
    ↓
Backend sends to Claude API with available tools
    ↓
Claude responds with tool call request
    ↓
Backend executes tool via MCP client
    ↓
Backend sends tool result back to Claude
    ↓
Claude generates final response
    ↓
Backend sends to frontend: {"type": "assistant_message", "content": "..."}
    ↓
Frontend displays assistant message
```

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY` - **Required**. Get from https://console.anthropic.com/
- `PORT` - Optional. Default: 3000
- `BERLIN_MCP_PATH` - Optional. Auto-detects `../berlin-open-data-mcp/dist/index.js`

### Development Ports

- Frontend dev server: `5173` (Vite)
- Backend server: `3000` (Express + WebSocket)

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is required"

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### "Failed to connect to MCP server"

1. Ensure Berlin MCP server is built:
   ```bash
   cd ../berlin-open-data-mcp
   npm run build
   ```

2. Check the path is correct (set `BERLIN_MCP_PATH` if needed)

### "WebSocket connection failed"

1. Ensure backend is running on port 3000
2. Check firewall settings
3. Look for errors in backend logs

### Messages not sending

1. Check WebSocket connection status in UI
2. Open browser console for errors
3. Verify backend logs show message received

## Testing

Run all tests:
```bash
npm test
```

Run backend tests only:
```bash
cd backend
npm test
```

Integration tests require `ANTHROPIC_API_KEY` to be set.

## Production Deployment

1. Build everything:
   ```bash
   npm run build
   ```

2. Set environment variables:
   ```bash
   export ANTHROPIC_API_KEY=your-key
   export PORT=3000
   ```

3. Start the server:
   ```bash
   cd backend
   npm start
   ```

4. Access at `http://your-server:3000`

The backend serves the compiled frontend automatically.
```

**Commit message:** `Update README with architecture details and troubleshooting`

---

### Task 4.3: Manual Testing Checklist

**What to do:** Manually verify all functionality works end-to-end.

**Create:** `/interface-prototype/docs/MANUAL_TEST_PLAN.md`

```markdown
# Manual Test Plan

## Pre-Testing Setup

- [ ] Berlin MCP server is built (`cd ../berlin-open-data-mcp && npm run build`)
- [ ] `ANTHROPIC_API_KEY` is set
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed

## Test 1: Server Startup

**Steps:**
1. Start backend: `npm run dev:backend`

**Expected:**
- ✅ No errors
- ✅ Logs show "Connected to Berlin MCP server"
- ✅ Shows number of tools loaded (should be 5)
- ✅ Server running on port 3000

## Test 2: Frontend Connection

**Steps:**
1. Start frontend: `npm run dev:frontend`
2. Open `http://localhost:5173`

**Expected:**
- ✅ Page loads
- ✅ Shows "Berlin Open Data Chat" header
- ✅ Status shows "Connected"
- ✅ Welcome message displays

## Test 3: Simple Query

**Steps:**
1. Type: "Find datasets about traffic"
2. Click Send or press Enter

**Expected:**
- ✅ Message appears in chat as user message
- ✅ Loading indicator shows
- ✅ Assistant responds within 30 seconds
- ✅ Response mentions datasets
- ✅ Loading indicator disappears

## Test 4: Multi-Turn Conversation

**Steps:**
1. Ask: "Find traffic datasets"
2. Wait for response
3. Ask: "Tell me more about the first one"

**Expected:**
- ✅ Both messages appear in history
- ✅ Second response references first dataset
- ✅ Conversation context is maintained

## Test 5: Portal Stats Query

**Steps:**
1. Ask: "How many datasets are in the portal?"

**Expected:**
- ✅ Assistant calls `get_portal_stats` tool
- ✅ Response includes actual numbers
- ✅ Response is informative

## Test 6: Data Fetching

**Steps:**
1. Ask: "Find traffic datasets and fetch the first one"

**Expected:**
- ✅ Assistant searches for datasets
- ✅ Assistant calls `fetch_dataset_data`
- ✅ Response includes data preview
- ✅ Response mentions columns and row count

## Test 7: Error Handling

**Steps:**
1. Stop the backend server
2. Try to send a message

**Expected:**
- ✅ Status changes to "Disconnected"
- ✅ Send button is disabled
- ✅ Error message appears

**Steps:**
1. Restart backend
2. Wait a few seconds

**Expected:**
- ✅ Status changes to "Connected"
- ✅ Send button is enabled
- ✅ Can send messages again

## Test 8: Long Response

**Steps:**
1. Ask: "List all available tools and what they do"

**Expected:**
- ✅ Response is complete (not cut off)
- ✅ All tools are listed
- ✅ Chat auto-scrolls to bottom

## Test 9: Special Characters

**Steps:**
1. Send message with special characters: "Find datasets about Straße & Verkehr (2024)"

**Expected:**
- ✅ Message displays correctly
- ✅ Special characters preserved
- ✅ Assistant responds normally

## Test 10: Multiple Rapid Messages

**Steps:**
1. Send 3 messages quickly without waiting for responses

**Expected:**
- ✅ All messages queue correctly
- ✅ Send button disabled while waiting
- ✅ Responses come back in order
- ✅ No messages lost

## Production Build Test

**Steps:**
1. Build: `npm run build`
2. Start: `cd backend && npm start`
3. Open: `http://localhost:3000`

**Expected:**
- ✅ Build completes without errors
- ✅ Server starts
- ✅ Can access via port 3000 (not 5173)
- ✅ All functionality works same as dev mode

## Performance Check

**Observations:**
- [ ] First message response time: _____ seconds
- [ ] Subsequent messages response time: _____ seconds
- [ ] WebSocket connection stable (no disconnects)
- [ ] No memory leaks (check browser dev tools)
- [ ] Backend CPU usage reasonable

## Notes

Document any issues found:
-
-
-
```

**Commit message:** `Add manual test plan for QA verification`

---

### Phase 4 Complete!

**Verification checklist:**
- [ ] Integration tests pass
- [ ] README is comprehensive
- [ ] Manual test plan created
- [ ] All tests in manual plan pass
- [ ] No console errors in browser
- [ ] No errors in backend logs

**Total commits:** 3

---

## Final Checklist

Before considering the project complete, verify:

**Code Quality:**
- [ ] All files have ABOUTME comments
- [ ] No TODO comments left in code
- [ ] No console.log (use proper logging)
- [ ] No hardcoded values (use env vars)
- [ ] Error handling is comprehensive
- [ ] TypeScript types are correct

**Functionality:**
- [ ] Can search for datasets
- [ ] Can get dataset details
- [ ] Can fetch dataset data
- [ ] Can get portal stats
- [ ] Multi-turn conversations work
- [ ] Error messages are clear
- [ ] Reconnection works

**Testing:**
- [ ] All automated tests pass
- [ ] Manual test plan completed
- [ ] Tested on clean install
- [ ] Tested with real API key

**Documentation:**
- [ ] README is accurate
- [ ] Setup instructions work
- [ ] Architecture is documented
- [ ] Troubleshooting guide helpful

**Git:**
- [ ] All changes committed
- [ ] Commit messages are descriptive
- [ ] No sensitive data in repo
- [ ] .gitignore is correct

---

## Post-Implementation: Next Steps

Once the interface prototype is working:

### Phase 5: Usage Analysis (Before Building Datawrapper MCP)

1. **Use the interface for real work**
   - Explore different datasets
   - Fetch and analyze data
   - Note what visualizations would be helpful

2. **Document findings:**
   - What chart types are needed?
   - What data formats come from Berlin MCP?
   - What transformations are needed before charting?

3. **Design Datawrapper MCP based on learnings:**
   - Minimal tool set
   - Handles actual data formats from Berlin
   - Focuses on chart types that are actually useful

### Future Enhancements

**UI Improvements:**
- Add syntax highlighting for code blocks (using a library like highlight.js)
- ✅ **DONE:** Show tool execution indicators ("Searching datasets...") - Implemented as ToolActivity component with hybrid display
- Add data preview panels
- Implement chart galleries

**Functionality:**
- Conversation persistence (save/load chats)
- Export conversations as markdown
- Share conversations via URL
- Multi-user support

**Performance:**
- Implement proper logging (Winston or similar)
- Add request caching where appropriate
- Optimize WebSocket message size
- Add rate limiting

**Developer Experience:**
- Add hot reload for backend
- Improve error messages
- Add debug mode
- Create Docker setup

---

## Estimated Timeline

**For experienced developer:**
- Phase 0 (Setup): 1-2 hours
- Phase 1 (Backend MCP Client): 3-4 hours
- Phase 2 (Backend WebSocket): 2-3 hours
- Phase 3 (Frontend): 3-4 hours
- Phase 4 (Testing & Docs): 2-3 hours

**Total:** 11-16 hours

**For less experienced developer:**
- Add 50% more time for learning
- Budget time for troubleshooting

---

## Getting Help

**Resources:**
- MCP SDK Docs: https://modelcontextprotocol.io/
- Claude API Docs: https://docs.anthropic.com/
- Svelte Tutorial: https://svelte.dev/tutorial
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

**Common Issues:**
- Check `docs/plans/design-spec.md` for architecture questions
- Check Berlin MCP README for tool usage
- Search issues on GitHub for similar problems
- Ask for help if stuck (don't spin wheels for hours)

---

## Success Criteria

The prototype is successful when you can:

✅ Ask "Find datasets about traffic" and get relevant results

✅ Ask "Fetch the first dataset" and see data preview

✅ Ask "How many datasets are in the portal?" and get stats

✅ Have multi-turn conversations with context

✅ See messages stream in real-time

✅ Recover from disconnections automatically

✅ Build and run in production mode

✅ Understand the code well enough to add features

---

## Notes for Maintainers

**Code Organization:**
- Backend: Each module has single responsibility
- Frontend: Components are small and focused
- Types: Centralized in types.ts

**Adding New Features:**
1. Update types.ts if needed
2. Implement in appropriate module
3. Add tests
4. Update README
5. Commit

**Connecting Additional MCP Servers:**
1. Create new MCPClientManager instance in server.ts
2. Merge tools from both servers
3. Pass merged tools to Claude
4. Route tool calls to correct server based on tool name

**Debugging:**
- Backend: Check console logs (add more logging if needed)
- Frontend: Browser console shows WebSocket messages
- MCP: Check if Berlin server is running correctly
- Claude: Check API key is valid and has credits

---

Good luck! 🚀
