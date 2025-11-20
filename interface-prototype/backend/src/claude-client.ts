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
  private model = 'claude-sonnet-4-5-20250929';

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
      // Transform MCP tools to Claude API format
      const claudeTools = this.transformToolsForClaude(tools);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: messages as any,
        tools: claudeTools
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
