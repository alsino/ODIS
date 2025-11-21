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

      // Send to Claude with tool execution callback and streaming
      const result = await this.claudeClient.sendMessageWithTools(
        content,
        history,
        tools,
        async (toolName: string, toolArgs: any) => {
          // Execute tool via MCP client
          return await this.mcpClient.callTool(toolName, toolArgs);
        },
        (chunk: string) => {
          // Stream text chunks to frontend as they arrive
          this.sendMessage(ws, {
            type: 'assistant_message_chunk',
            content: chunk,
            done: false
          });
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
