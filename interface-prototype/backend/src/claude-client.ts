// ABOUTME: Claude API client that handles conversation and tool calling
// ABOUTME: Manages message history and streaming responses

import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ConversationMessage } from './types.js';

export interface ClaudeResponse {
  content: string;
  toolCalls?: ToolCall[];
  stopReason: string | null;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export class ClaudeClient {
  private client: Anthropic;
  private model = 'claude-haiku-4-5';
  private systemPrompt = `You are an assistant helping users discover and analyze open data from Berlin's Open Data Portal.

You have access to tools that connect to the Berlin Open Data Portal. ALWAYS use these tools when users ask about datasets or data. NEVER make up or fabricate datasets, data, or analysis.

Key guidelines:
- Use search_berlin_datasets to find relevant datasets
- Use get_dataset_details to get more information about a specific dataset
- Use fetch_dataset_data to retrieve actual data from datasets
- Only provide analysis based on data you've actually retrieved via tools
- If you cannot find a dataset, tell the user clearly - do not invent one
- When you fetch data, work with what's actually returned - do not extrapolate or fabricate additional data
- Be helpful and conversational, but always grounded in the real data from the portal`;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Transform MCP tools to Claude API format
   * MCP uses inputSchema, Claude uses input_schema
   */
  private transformToolsForClaude(mcpTools: Tool[]): any[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
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
      console.log('[ClaudeClient] sendMessage: Preparing API request');
      // Transform MCP tools to Claude API format
      const claudeTools = this.transformToolsForClaude(tools);

      console.log('[ClaudeClient] sendMessage: Calling Claude API...');
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: messages as any,
        tools: claudeTools
      });

      console.log('[ClaudeClient] sendMessage: API response received, id:', response.id, 'model:', response.model);

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
   * Send a message with streaming support
   * Streams text deltas via callback as they arrive
   */
  async sendMessageStreaming(
    messages: ConversationMessage[],
    tools: Tool[],
    streamCallback: (chunk: string) => void
  ): Promise<ClaudeResponse> {
    try {
      const claudeTools = this.transformToolsForClaude(tools);

      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: messages as any,
        tools: claudeTools
      });

      let fullText = '';
      const toolCalls: ToolCall[] = [];

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            const chunk = event.delta.text;
            fullText += chunk;
            streamCallback(chunk);
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            toolCalls.push({
              id: event.content_block.id,
              name: event.content_block.name,
              input: event.content_block.input
            });
          }
        }
      }

      return {
        content: fullText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        stopReason: 'end_turn'
      };
    } catch (error) {
      console.error('Claude API streaming error:', error);
      throw error;
    }
  }

  /**
   * Send message and handle tool calling loop
   * Executes tools via provided callback and continues until final response
   * Returns both the final response text and the complete updated message history
   *
   * @param userMessage - The user's message to send
   * @param conversationHistory - Previous messages in the conversation
   * @param tools - Available MCP tools
   * @param executeToolCallback - Callback to execute a tool (called for each tool use)
   * @param streamCallback - Optional callback for streaming text chunks as they arrive
   * @param toolActivityCallback - Optional callback for tool execution events (start/complete)
   *                                Enables real-time tool activity display in the UI
   */
  async sendMessageWithTools(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    tools: Tool[],
    executeToolCallback: (name: string, args: any) => Promise<any>,
    streamCallback?: (chunk: string) => void,
    toolActivityCallback?: (activity: { type: 'start' | 'complete', toolCallId: string, toolName: string, toolArgs?: any, result?: string, isError?: boolean }) => void
  ): Promise<{ response: string; messages: ConversationMessage[] }> {
    console.log('[ClaudeClient] sendMessageWithTools called with message:', userMessage);
    console.log('[ClaudeClient] Conversation history length:', conversationHistory.length);
    console.log('[ClaudeClient] Available tools:', tools.length);

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
      console.log(`[ClaudeClient] Iteration ${iterations}/${maxIterations}`);

      // Use streaming for final response (when no tool calls expected)
      const isLikelyFinalResponse = iterations > 1;

      if (isLikelyFinalResponse && streamCallback) {
        // Try streaming - if we get tool calls, we'll handle them normally
        console.log('[ClaudeClient] Using streaming for likely final response');
        const response = await this.sendMessageStreaming(messages, tools, streamCallback);
        console.log('[ClaudeClient] Streaming response received, stopReason:', response.stopReason);

        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalResponse = response.content;
          break;
        }

        // If we got tool calls despite streaming, continue with tool execution
        // Note: intro text was already streamed by sendMessageStreaming
        // Add assistant's response to history (both text and tool use)
        const assistantContent: any[] = [];

        // Include intro text if present
        if (response.content && response.content.trim()) {
          assistantContent.push({
            type: 'text',
            text: response.content
          });
        }

        // Add tool use blocks
        response.toolCalls.forEach(tc => {
          assistantContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input
          });
        });

        messages.push({
          role: 'assistant',
          content: assistantContent
        });

        // Execute tools and collect results
        const toolResults = [];
        for (const toolCall of response.toolCalls) {
          try {
            // Notify that tool execution is starting
            toolActivityCallback?.({
              type: 'start',
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              toolArgs: toolCall.input
            });

            const result = await executeToolCallback(toolCall.name, toolCall.input);

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

            // Notify that tool execution completed
            toolActivityCallback?.({
              type: 'complete',
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              result: resultText
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: resultText
            });
          } catch (error) {
            console.error(`Tool execution error for ${toolCall.name}:`, error);
            const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;

            // Notify that tool execution failed
            toolActivityCallback?.({
              type: 'complete',
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              result: errorMessage,
              isError: true
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: errorMessage,
              is_error: true
            });
          }
        }

        messages.push({
          role: 'user',
          content: toolResults
        });

        continue;
      }

      console.log('[ClaudeClient] Calling sendMessage (non-streaming)');
      const response = await this.sendMessage(messages, tools);
      console.log('[ClaudeClient] Response received, content length:', response.content.length, 'toolCalls:', response.toolCalls?.length || 0);

      // If no tool calls, we have final response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalResponse = response.content;
        // Stream the response if callback provided (iteration 1 uses non-streaming mode)
        if (streamCallback && response.content) {
          streamCallback(response.content);
        }
        console.log('[ClaudeClient] Final response received, breaking loop');
        break;
      }

      // Execute tool calls
      console.log(`Claude requested ${response.toolCalls.length} tool calls`);

      // If Claude provided intro text along with tool calls, stream it immediately
      // This shows the user what Claude is about to do (e.g., "Let me search for that...")
      if (response.content && response.content.trim() && streamCallback) {
        streamCallback(response.content);
      }

      // Add assistant's response to history (both text and tool use)
      const assistantContent: any[] = [];

      // Include intro text if present
      if (response.content && response.content.trim()) {
        assistantContent.push({
          type: 'text',
          text: response.content
        });
      }

      // Add tool use blocks
      response.toolCalls.forEach(tc => {
        assistantContent.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input
        });
      });

      messages.push({
        role: 'assistant',
        content: assistantContent
      });

      // Execute tools and collect results
      const toolResults = [];
      for (const toolCall of response.toolCalls) {
        try {
          // Notify that tool execution is starting
          toolActivityCallback?.({
            type: 'start',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            toolArgs: toolCall.input
          });

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

          // Notify that tool execution completed
          toolActivityCallback?.({
            type: 'complete',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: resultText
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: resultText
          });
        } catch (error) {
          console.error(`Tool execution error for ${toolCall.name}:`, error);
          const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;

          // Notify that tool execution failed
          toolActivityCallback?.({
            type: 'complete',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: errorMessage,
            isError: true
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: errorMessage,
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
      console.warn('[ClaudeClient] Max tool calling iterations reached');
      finalResponse = finalResponse || 'I apologize, but I encountered too many tool calls. Please try rephrasing your question.';
    }

    console.log('[ClaudeClient] Returning final response, length:', finalResponse.length);
    return {
      response: finalResponse,
      messages: messages
    };
  }
}
