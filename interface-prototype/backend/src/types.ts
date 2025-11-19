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

export type WebSocketMessage = UserMessage | AssistantMessage | ErrorMessage | StatusMessage;

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
