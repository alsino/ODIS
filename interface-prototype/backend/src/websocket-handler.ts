// ABOUTME: WebSocket handler for real-time communication with frontend
// ABOUTME: Processes user messages and streams Claude responses back

import type { WebSocket } from 'ws';
import type { MCPClientManager } from './mcp-client.js';
import type { ClaudeClient } from './claude-client.js';
import type { ConversationMessage, WebSocketMessage, UserMessage } from './types.js';
import { CodeExecutor } from './code-executor.js';

export class WebSocketHandler {
  private conversationHistory: Map<WebSocket, ConversationMessage[]> = new Map();
  private codeExecutor: CodeExecutor;
  private fetchedDatasets: Map<WebSocket, Map<string, any[]>> = new Map();

  constructor(
    private berlinMcpClient: MCPClientManager,
    private claudeClient: ClaudeClient,
    private datawrapperMcpClient?: MCPClientManager
  ) {
    this.codeExecutor = new CodeExecutor();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket): void {
    console.log('New WebSocket connection');

    // Initialize conversation history and dataset cache for this connection
    this.conversationHistory.set(ws, []);
    this.fetchedDatasets.set(ws, new Map());

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
      this.fetchedDatasets.delete(ws);
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
      // Get available tools from both MCP clients
      const berlinTools = this.berlinMcpClient.getTools();
      const datawrapperTools = this.datawrapperMcpClient?.getTools() || [];
      const mcpTools = [...berlinTools, ...datawrapperTools];

      // Add code execution tool
      const codeExecutionTool = {
        name: 'execute_code',
        description: 'Execute JavaScript code to analyze a dataset that was previously fetched with fetch_dataset_data. Use this tool immediately after fetch_dataset_data whenever you need to count, aggregate, filter, or calculate statistics. DO NOT try to count or calculate manually - always use this tool for accurate results.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute. The fetched dataset will be available as the "data" variable (an array of objects). Use standard JavaScript array methods like data.reduce(), data.map(), data.filter(). IMPORTANT: The value of the LAST EXPRESSION is returned as the result. DO NOT use console.log() - it returns undefined. Examples:\n- Count total rows: "data.length"\n- Count by bezirk: "data.reduce((acc, row) => { acc[row.bezirk] = (acc[row.bezirk] || 0) + 1; return acc; }, {})"\n- Return object literal: Wrap in parentheses: "({ total: data.length, unique: [...new Set(data.map(row => row.bezirk))] })"\n- Get unique values: "[...new Set(data.map(row => row.bezirk))]"'
            },
            dataset_id: {
              type: 'string',
              description: 'Optional: The dataset ID to use. If not provided, will use the most recently fetched dataset. Example: "fahrradreparaturstationen-wfs-ffeaba56"'
            }
          },
          required: ['code']
        }
      };

      const tools = [...mcpTools, codeExecutionTool];

      // Send to Claude with tool execution callback and streaming
      const result = await this.claudeClient.sendMessageWithTools(
        content,
        history,
        tools,
        async (toolName: string, toolArgs: any) => {
          // Handle code execution locally
          if (toolName === 'execute_code') {
            // Log what we received
            console.log('[execute_code] Received toolArgs:', JSON.stringify(toolArgs, null, 2));

            let { dataset_id, code } = toolArgs as { dataset_id?: string; code?: string };
            const datasetCache = this.fetchedDatasets.get(ws);

            // Auto-detect dataset_id if not provided
            if (!dataset_id && datasetCache && datasetCache.size > 0) {
              // Get the most recently cached dataset
              const datasets = Array.from(datasetCache.keys());
              dataset_id = datasets[datasets.length - 1];
              console.log('[execute_code] Auto-detected dataset_id:', dataset_id);
            }

            // Validate code parameter
            if (!code) {
              console.error('[execute_code] Missing code parameter. toolArgs:', toolArgs);
              return {
                content: [{
                  type: 'text',
                  text: `Error: execute_code requires a 'code' parameter with JavaScript code to execute. Example: { "code": "data.length" }`
                }],
                isError: true
              };
            }

            // Validate dataset_id
            if (!dataset_id) {
              console.error('[execute_code] No dataset_id provided and no cached datasets found');
              return {
                content: [{
                  type: 'text',
                  text: `Error: No dataset available. Please use fetch_dataset_data first to load a dataset.`
                }],
                isError: true
              };
            }

            // Get cached dataset
            const data = datasetCache?.get(dataset_id);

            if (!data) {
              console.error('[execute_code] Dataset not found in cache:', dataset_id);
              return {
                content: [{
                  type: 'text',
                  text: `Error: Dataset "${dataset_id}" not found. Please use fetch_dataset_data first to load the dataset.`
                }],
                isError: true
              };
            }

            console.log('[execute_code] Executing code on', dataset_id, 'with', data.length, 'rows');
            const executionResult = await this.codeExecutor.execute(code, { data });

            if (executionResult.success) {
              console.log('[execute_code] Success, execution time:', executionResult.executionTime, 'ms');
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(executionResult.output, null, 2)
                }]
              };
            } else {
              console.error('[execute_code] Execution failed:', executionResult.error);
              return {
                content: [{
                  type: 'text',
                  text: `Error executing code: ${executionResult.error}`
                }],
                isError: true
              };
            }
          }

          // Route tool call to appropriate MCP client
          // Datawrapper tools: create_visualization
          // Berlin tools: search_datasets, fetch_dataset_data, download_dataset
          const isDatawrapperTool = toolName === 'create_visualization';
          const mcpClient = isDatawrapperTool ? this.datawrapperMcpClient : this.berlinMcpClient;

          if (!mcpClient) {
            throw new Error(`MCP client not available for tool: ${toolName}`);
          }

          // Use extended timeout for download_dataset (5 minutes) to handle WFS datasets
          const timeout = toolName === 'download_dataset' ? 300000 : undefined;
          const result = await mcpClient.callTool(toolName, toolArgs, timeout ? { timeout } : undefined);

          // Extract text from MCP result structure
          let resultText = '';
          if (result && result.content && Array.isArray(result.content)) {
            // MCP returns { content: [{ type: 'text', text: '...' }] }
            const textContent = result.content.find((item: any) => item.type === 'text');
            if (textContent) {
              resultText = textContent.text;
            }
          } else if (typeof result === 'string') {
            resultText = result;
          }

          // Cache dataset if this was fetch_dataset_data
          if (toolName === 'fetch_dataset_data') {
            const { dataset_id } = toolArgs as { dataset_id: string };
            // Extract JSON from markdown code block
            const jsonMatch = resultText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && dataset_id) {
              try {
                const parsedData = JSON.parse(jsonMatch[1]);
                const datasetCache = this.fetchedDatasets.get(ws);
                if (datasetCache && Array.isArray(parsedData)) {
                  datasetCache.set(dataset_id, parsedData);
                  console.log('[fetch_dataset_data] Cached', parsedData.length, 'rows for', dataset_id);
                }
              } catch (error) {
                console.error('[fetch_dataset_data] Failed to parse/cache dataset:', error);
              }
            }
          }

          console.log('[WebSocket] Tool result text length:', resultText.length);
          console.log('[WebSocket] Checking for download marker...');

          // Check if the result contains a file download
          const downloadMatch = resultText.match(/\[DOWNLOAD:([^:]+):([^\]]+)\]\n([\s\S]*)/);

          if (downloadMatch) {
            console.log('[WebSocket] Download marker found!');
            const [, filename, mimeType, fileContent] = downloadMatch;

            // Extract the message before the download marker
            const messageBeforeDownload = resultText.substring(0, resultText.indexOf('[DOWNLOAD:'));

            // Send file download message immediately
            this.sendMessage(ws, {
              type: 'file_download',
              filename: filename,
              mimeType: mimeType,
              content: fileContent
            });

            // Return only the message part (without the file content) as the tool result
            // Keep the same structure as the original result
            return {
              content: [{ type: 'text', text: messageBeforeDownload.trim() }]
            };
          }

          // Check if the result contains a chart embed - but don't strip it, pass it through
          // The chart will be rendered inline in the message
          if (resultText.includes('[CHART:')) {
            console.log('[WebSocket] Chart marker found in tool result');
          }

          return result;
        },
        (chunk: string) => {
          // Check if this is a file download
          const downloadMatch = chunk.match(/\[DOWNLOAD:([^:]+):([^\]]+)\]\n([\s\S]*)/);
          if (downloadMatch) {
            const [, filename, mimeType, fileContent] = downloadMatch;

            // Extract the message before the download marker
            const messageBeforeDownload = chunk.substring(0, chunk.indexOf('[DOWNLOAD:'));

            // Send the message text first (without the file content)
            if (messageBeforeDownload.trim()) {
              this.sendMessage(ws, {
                type: 'assistant_message_chunk',
                content: messageBeforeDownload,
                done: false
              });
            }

            // Send file download message
            this.sendMessage(ws, {
              type: 'file_download',
              filename: filename,
              mimeType: mimeType,
              content: fileContent
            });
          } else {
            // Regular text chunk - stream to frontend
            this.sendMessage(ws, {
              type: 'assistant_message_chunk',
              content: chunk,
              done: false
            });
          }
        },
        (activity) => {
          // Forward tool activity to frontend for real-time display
          // This allows the UI to show a spinner during execution and
          // then display results in an expandable badge when complete
          if (activity.type === 'start') {
            this.sendMessage(ws, {
              type: 'tool_call_start',
              toolCallId: activity.toolCallId,
              toolName: activity.toolName,
              toolArgs: activity.toolArgs
            });
          } else {
            this.sendMessage(ws, {
              type: 'tool_call_complete',
              toolCallId: activity.toolCallId,
              toolName: activity.toolName,
              result: activity.result || '',
              isError: activity.isError
            });
          }
        }
      );

      // Update conversation history with complete message chain (includes tool calls and results)
      this.conversationHistory.set(ws, result.messages);

      // Send final done message
      this.sendMessage(ws, {
        type: 'assistant_message',
        content: '',
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
