# Interface Prototype - Design Specification

## Document Overview

This document captures the complete design specification for the Interface Prototype - a web-based chat interface that replicates Claude Desktop's behavior for working with the Berlin Open Data MCP server (and eventually the Datawrapper MCP server).

---

## Section 1: Project Goals & Context

### What We're Building

A simple web application that allows users to interact with the Berlin Open Data MCP server through a conversational chat interface, powered by Claude AI. This prototype serves as:

1. A practical alternative to Claude Desktop for testing and using the Berlin Open Data MCP
2. A foundation for eventually integrating the Datawrapper MCP server
3. A demonstration of how to build web interfaces that work with MCP servers

### Why We're Building This

**Current State:** The Berlin Open Data MCP server works great in Claude Desktop, but:
- Users need to install and configure Claude Desktop
- Limited to desktop usage only
- Cannot be shared easily with others
- Difficult to customize the interface

**Desired State:** A web-based tool that:
- Provides the same conversational experience as Claude Desktop
- Can run locally or be deployed to a server
- Allows for future UI enhancements based on actual usage patterns
- Demonstrates proper MCP protocol integration

### Core Philosophy

**Start simple, iterate based on usage:**
- Build minimal viable interface first (chat only)
- Use it to understand what visualizations/features are actually needed
- Add Datawrapper integration based on real usage patterns (not speculation)

**Proper architecture from the start:**
- Use actual MCP protocol (not shortcuts)
- Follow the same client-server model as Claude Desktop
- Build it right so it can grow without major rewrites

**Developer-friendly:**
- Easy to run locally
- Clear separation of concerns
- Well-documented for future enhancement

---

## Section 2: User Experience

### Target Users

1. **Data analysts/researchers** exploring Berlin's open data
2. **Developers** testing the MCP server integration
3. **Alsino** (primary user) for daily work with Berlin datasets

### Primary Use Case

**Conversational data discovery and analysis:**

```
User: "Find datasets about traffic in Berlin"
→ System calls search_berlin_datasets tool
→ Claude responds with list of relevant datasets

User: "Fetch the traffic volume data and show me the columns"
→ System calls get_dataset_details, then fetch_dataset_data
→ Claude responds with data preview and column information

User: "What's the average traffic volume by district?"
→ Claude analyzes the fetched data and provides answer
```

### Interface Design

**Version 1 (Initial):**
- **Pure chat interface** - Single conversation thread
- **Text only** - All responses appear inline (no separate panels)
- **No visual indicators** - Tools execute behind the scenes
- **Minimal styling** - Clean, functional, not fancy

**What's explicitly NOT included in v1:**
- Separate data preview panels
- Chart galleries
- Tool execution visualization
- Dashboard layouts
- File upload
- Export functionality

**Future enhancements** (add based on actual need):
- Activity feed showing which tools are being called
- Separate panels for data preview
- Chart visualization areas
- Structured workflow guides

---

## Section 3: Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Web Browser                         │
│  ┌──────────────────────────────────────────────┐  │
│  │        Svelte Frontend                       │  │
│  │  - Chat UI                                   │  │
│  │  - Message history                           │  │
│  │  - Input area                                │  │
│  └──────────────────┬───────────────────────────┘  │
└─────────────────────┼──────────────────────────────┘
                      │ WebSocket
                      │
┌─────────────────────▼──────────────────────────────┐
│          Node.js/Express Backend                   │
│  ┌──────────────────────────────────────────────┐ │
│  │  MCP Client (uses @modelcontextprotocol/sdk) │ │
│  │  - Maintains connections to MCP servers      │ │
│  │  - Executes tool calls                       │ │
│  └──────────────────┬───────────────────────────┘ │
│  ┌──────────────────▼───────────────────────────┐ │
│  │  Claude API Integration                      │ │
│  │  - Sends messages + tool definitions         │ │
│  │  - Handles streaming responses               │ │
│  │  - Manages conversation history              │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────┬──────────────────────────────┘
                      │ stdio (MCP protocol)
                      │
┌─────────────────────▼──────────────────────────────┐
│         Berlin Open Data MCP Server                │
│  - search_berlin_datasets                          │
│  - get_dataset_details                             │
│  - fetch_dataset_data                              │
│  - get_portal_stats                                │
│  - list_all_datasets                               │
└────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Svelte Frontend

**Responsibilities:**
- Render chat interface (messages, input)
- Send user messages to backend via WebSocket
- Receive and display streaming responses from backend
- Maintain UI state (loading indicators, message history)

**Technology:**
- Svelte 4+ with SvelteKit (or Vite)
- WebSocket client for real-time communication
- Minimal CSS (no heavy frameworks initially)

**Does NOT handle:**
- Any MCP logic
- Direct API calls to Claude
- Tool execution
- Conversation history management (backend owns this)

#### 2. Node.js Backend

**Responsibilities:**
- Serve the compiled Svelte app
- Act as MCP client (connect to Berlin MCP server)
- Integrate with Claude API
- Execute tool calls requested by Claude
- Stream responses back to frontend
- Manage conversation history

**Technology:**
- Express for HTTP server
- ws (WebSocket library) for real-time communication
- @modelcontextprotocol/sdk for MCP client
- @anthropic-ai/sdk for Claude API
- Child process spawning for MCP servers

**Key Implementation Details:**
- Spawns Berlin MCP server as child process using stdio transport
- Collects tool definitions from MCP server on startup
- For each user message:
  1. Add to conversation history
  2. Send to Claude with available tools
  3. Handle tool call loop (Claude may call multiple tools)
  4. Stream final response to frontend
- Maintains persistent WebSocket connections to frontend

#### 3. Berlin Open Data MCP Server

**Status:** Already complete, no changes needed

**How it's used:**
- Backend spawns it as child process: `node berlin-open-data-mcp/dist/index.js`
- Communicates via stdio using MCP protocol
- Backend calls `client.listTools()` to get available tools
- Backend calls `client.callTool(name, args)` to execute tools

---

## Section 4: Technical Decisions

### Decision 1: Full MCP Protocol vs Direct Integration

**Options considered:**
- A) Use full MCP protocol (SDK client connecting to MCP servers)
- B) Skip MCP, directly import functions from server code
- C) Create custom API layer

**Decision:** A - Full MCP protocol

**Rationale:**
- Demonstrates proper MCP usage (educational value)
- Allows easy addition of more MCP servers later
- Tests the same code path as Claude Desktop
- More realistic for eventual deployment scenarios

**Trade-offs:**
- More complex setup (spawn processes, manage connections)
- BUT: More authentic and extensible

### Decision 2: Frontend Framework

**Options considered:**
- A) Vanilla HTML/CSS/JS
- B) Svelte
- C) React

**Decision:** B - Svelte

**Rationale:**
- Alsino is more familiar with Svelte
- Less boilerplate than React
- Compiles to efficient vanilla JS
- Great for smaller apps like this

**Trade-offs:**
- Smaller ecosystem than React
- BUT: We don't need a large ecosystem for this

### Decision 3: Real-time Communication

**Options considered:**
- A) WebSocket for bidirectional streaming
- B) HTTP polling
- C) Server-Sent Events (SSE)

**Decision:** A - WebSocket

**Rationale:**
- Enables real-time streaming of Claude's responses
- Bidirectional (server can push updates)
- Standard approach for chat interfaces
- Well-supported in Node.js (ws library)

**Trade-offs:**
- More complex than HTTP
- BUT: Necessary for good UX (streaming responses)

### Decision 4: Authentication Strategy

**Options considered:**
- A) Users provide their own Claude API key
- B) Single API key on backend
- C) Full auth system
- D) No auth initially

**Decision:** D - No auth initially (hardcoded for prototype)

**Rationale:**
- YAGNI - build it when we need it
- Focus on core functionality first
- Can add environment variable setup later
- Prototype is for personal/testing use initially

**Trade-offs:**
- Not ready for multi-user deployment
- BUT: That's not the immediate goal

### Decision 5: Build Datawrapper MCP When?

**Options considered:**
- A) Build Datawrapper MCP first, then interface
- B) Build interface first, then Datawrapper based on learnings

**Decision:** B - Interface first

**Rationale:**
- Learn actual usage patterns before designing visualization tools
- Get value immediately (chat interface for Berlin data)
- Avoid over-engineering Datawrapper integration
- Interface can connect to Datawrapper later without major changes

**Trade-offs:**
- Initial version won't have visualizations
- BUT: We learn what visualizations are actually needed

---

## Section 5: Data Flow & Request Handling

### Startup Sequence

1. Backend starts Express server
2. Backend spawns Berlin MCP server as child process
3. Backend creates MCP client, connects via stdio
4. Backend calls `client.listTools()` to get available tools
5. Backend starts WebSocket server
6. Frontend loads, connects to backend via WebSocket
7. System ready for user input

### Message Flow (User Query)

**Example: User types "Find traffic datasets"**

1. **Frontend → Backend (WebSocket):**
   ```json
   {
     "type": "user_message",
     "content": "Find traffic datasets"
   }
   ```

2. **Backend → Claude API:**
   ```json
   {
     "model": "claude-3-5-sonnet-20241022",
     "messages": [
       {"role": "user", "content": "Find traffic datasets"}
     ],
     "tools": [
       {
         "name": "search_berlin_datasets",
         "description": "Search datasets...",
         "input_schema": {...}
       },
       // ... other tools from Berlin MCP
     ]
   }
   ```

3. **Claude API → Backend (Response with tool call):**
   ```json
   {
     "role": "assistant",
     "content": [
       {
         "type": "tool_use",
         "id": "toolu_123",
         "name": "search_berlin_datasets",
         "input": {"query": "traffic", "limit": 10}
       }
     ]
   }
   ```

4. **Backend → Berlin MCP Server:**
   ```typescript
   const result = await client.callTool({
     name: "search_berlin_datasets",
     arguments: {query: "traffic", limit: 10}
   });
   ```

5. **Berlin MCP → Backend (Tool result):**
   ```json
   {
     "content": [
       {
         "type": "text",
         "text": "# Search Results\n\nFound 15 datasets..."
       }
     ]
   }
   ```

6. **Backend → Claude API (Tool result):**
   ```json
   {
     "messages": [
       {"role": "user", "content": "Find traffic datasets"},
       {
         "role": "assistant",
         "content": [
           {"type": "tool_use", "id": "toolu_123", ...}
         ]
       },
       {
         "role": "user",
         "content": [
           {
             "type": "tool_result",
             "tool_use_id": "toolu_123",
             "content": "# Search Results..."
           }
         ]
       }
     ]
   }
   ```

7. **Claude API → Backend (Final response):**
   ```json
   {
     "role": "assistant",
     "content": [
       {
         "type": "text",
         "text": "I found 15 datasets about traffic in Berlin..."
       }
     ]
   }
   ```

8. **Backend → Frontend (Stream response):**
   ```json
   {
     "type": "assistant_message",
     "content": "I found 15 datasets about traffic in Berlin...",
     "done": true
   }
   ```

9. **Frontend renders** the assistant's message in the chat UI

### Multi-Tool Call Handling

Claude may request multiple tool calls in sequence. Backend must:
1. Execute first tool call
2. Send result back to Claude
3. If Claude requests another tool, execute it
4. Continue until Claude returns final text response
5. Stream final response to frontend

### Error Handling

**Tool execution fails:**
- Backend sends error details back to Claude as tool result
- Claude can explain the error to the user or try alternative approach

**MCP server crashes:**
- Backend detects stdio connection loss
- Attempts to restart MCP server
- If restart fails, sends error message to frontend

**Claude API error:**
- Backend catches error
- Sends user-friendly message to frontend
- Logs technical details for debugging

**WebSocket disconnection:**
- Frontend attempts automatic reconnection
- Shows "reconnecting..." indicator
- Restores connection, resumes from last message

---

## Section 6: File Structure

```
interface-prototype/
├── docs/
│   └── plans/
│       ├── design-spec.md (this file)
│       └── implementation-plan.md (to be created)
├── src/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.svelte (main chat component)
│   │   │   ├── lib/
│   │   │   │   ├── Chat.svelte (chat container)
│   │   │   │   ├── Message.svelte (individual message)
│   │   │   │   └── Input.svelte (message input area)
│   │   │   └── main.js (entry point)
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.js
│   └── backend/
│       ├── src/
│       │   ├── server.ts (Express + WebSocket server)
│       │   ├── mcp-client.ts (MCP connection management)
│       │   ├── claude-client.ts (Claude API integration)
│       │   └── types.ts (TypeScript type definitions)
│       ├── package.json
│       └── tsconfig.json
├── package.json (workspace root)
└── README.md
```

---

## Section 7: Development & Deployment

### Local Development Setup

1. Clone repository
2. Install dependencies: `npm install` (in root, backend, frontend)
3. Set Claude API key: `export ANTHROPIC_API_KEY=sk-...`
4. Start Berlin MCP server: Automatically spawned by backend
5. Start backend: `cd src/backend && npm run dev`
6. Start frontend: `cd src/frontend && npm run dev`
7. Open browser to `http://localhost:5173`

### Production Build

1. Build backend: `cd src/backend && npm run build`
2. Build frontend: `cd src/frontend && npm run build`
3. Backend serves frontend from `dist/` folder
4. Run: `node backend/dist/server.js`

### Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` - Claude API key

**Optional:**
- `PORT` - Backend port (default: 3000)
- `BERLIN_MCP_PATH` - Path to Berlin MCP server (default: auto-detect)

### Testing Strategy

**Unit Tests:**
- Backend: Tool execution logic, message formatting
- Frontend: Component rendering, WebSocket handling

**Integration Tests:**
- Backend can spawn and connect to Berlin MCP
- Backend can call tools and receive results
- End-to-end message flow (mock Claude API)

**Manual Testing:**
- Full conversation flows with real Claude API
- Tool calling works correctly
- Streaming responses display properly
- Error handling (MCP crashes, API errors)

---

## Section 8: Success Criteria

The prototype is considered successful when:

✅ User can type natural language queries in the web interface

✅ Claude's responses stream in real-time (not all at once)

✅ Berlin MCP tools are called correctly based on user queries

✅ Tool results are processed and incorporated into Claude's responses

✅ Multi-turn conversations work (conversation history is maintained)

✅ Error messages are clear and actionable

✅ Interface is responsive and feels similar to Claude Desktop

✅ Developer can easily add more MCP servers later (architecture is clean)

---

## Section 9: Non-Goals (What We're NOT Building)

**Not in scope for v1:**
- Multi-user support / authentication
- Conversation persistence (saving chat history to database)
- Data export features
- Advanced UI (charts, graphs, dashboards)
- File upload
- Mobile app / responsive mobile design
- Rate limiting / API usage tracking
- Admin interface
- User accounts / profiles
- Collaboration features (sharing chats)

**Deferred to future versions:**
- Datawrapper MCP integration (build after learning usage patterns)
- Visual tool execution indicators
- Separate data preview panels
- Chart galleries
- Advanced error recovery

---

## Section 10: Open Questions

**Q1: Should we show which tools are being executed?**
- Current decision: No (keep it simple)
- Reconsider when: Users express confusion about what's happening

**Q2: Should we persist conversation history?**
- Current decision: No (in-memory only)
- Reconsider when: Users want to save/reload conversations

**Q3: How should we handle very long Claude responses?**
- Current decision: Show everything inline
- Reconsider when: Responses become too long and unwieldy

**Q4: Should we add syntax highlighting for code blocks?**
- Current decision: Not initially
- Reconsider when: Users frequently get code in responses

**Q5: What should happen when MCP server restarts?**
- Current decision: Attempt auto-reconnect, inform user if it fails
- Implementation details TBD

---

## Document History

**Version 1.0** - Initial design specification based on discovery conversation with Alsino

**Future versions:** Will be updated as implementation progresses and usage patterns emerge
