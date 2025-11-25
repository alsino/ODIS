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

  constructor(
    private mcpClient: MCPClientManager,
    private claudeClient: ClaudeClient
  ) {
    this.codeExecutor = new CodeExecutor();
  }

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
      const mcpTools = this.mcpClient.getTools();

      // Add code execution tool
      const codeExecutionTool = {
        name: 'execute_code',
        description: 'Execute JavaScript code to analyze data. Use this when you need to perform accurate calculations, counting, or aggregations on datasets. The code runs in a sandboxed environment with access to the data variable.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute. The dataset is available as the "data" variable. Return the result as the last expression.'
            },
            data: {
              type: 'array',
              description: 'The dataset to analyze (array of objects)'
            }
          },
          required: ['code', 'data']
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
            const { code, data } = toolArgs as { code: string; data: any[] };
            const executionResult = await this.codeExecutor.execute(code, { data });

            if (executionResult.success) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(executionResult.output, null, 2)
                }]
              };
            } else {
              return {
                content: [{
                  type: 'text',
                  text: `Error executing code: ${executionResult.error}`
                }],
                isError: true
              };
            }
          }

          // Execute tool via MCP client
          const result = await this.mcpClient.callTool(toolName, toolArgs);

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
