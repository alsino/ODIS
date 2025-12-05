<!-- ABOUTME: Main chat container component -->
<!-- ABOUTME: Manages WebSocket connection and displays message history -->

<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import Message from './Message.svelte';
  import Input from './Input.svelte';
  import ToolActivity from './ToolActivity.svelte';

  let messages = [];
  // Track whether we're currently in a tool-calling phase
  let inToolPhase = false;
  // Buffer for intermediate "thinking" text between tool calls
  let intermediateTextBuffer = '';
  let ws = null;
  let connected = false;
  let waiting = false;
  let error = null;
  let showSpacer = false;

  onMount(() => {
    connectWebSocket();
  });

  onDestroy(() => {
    if (ws) {
      ws.close();
    }
  });

  function triggerDownload(filename, content, mimeType) {
    // Create a Blob from the content
    const blob = new Blob([content], { type: mimeType });

    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = import.meta.env.DEV ? '3000' : window.location.port;
    const wsUrl = `${protocol}//${window.location.hostname}:${port}/ws`;

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
    // console.log('Received message:', data);

    if (data.type === 'status') {
      console.log('Status:', data.status);
    } else if (data.type === 'tool_call_start') {
      // Tool execution started - add to the current assistant message
      // The tool will show with a spinner in the ToolActivity component
      inToolPhase = true;
      const newToolCall = {
        id: data.toolCallId,
        name: data.toolName,
        args: data.toolArgs,
        completed: false,
        introText: intermediateTextBuffer.trim() // Attach buffered thinking text to this tool
      };

      // Clear the buffer after attaching
      intermediateTextBuffer = '';

      // Add to the current streaming message immediately
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        if (!messages[messages.length - 1].toolCalls) {
          messages[messages.length - 1].toolCalls = [];
        }
        messages[messages.length - 1].toolCalls = [...messages[messages.length - 1].toolCalls, newToolCall];
        messages = messages; // Trigger reactivity
      }
    } else if (data.type === 'tool_call_complete') {
      // Tool execution completed - update the tool call with results
      // Update the tool in the current assistant message
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].toolCalls) {
        messages[messages.length - 1].toolCalls = messages[messages.length - 1].toolCalls.map(call =>
          call.id === data.toolCallId
            ? { ...call, completed: true, result: data.result, isError: data.isError }
            : call
        );
        messages = messages; // Trigger reactivity
      }
    } else if (data.type === 'file_download') {
      // File download ready - trigger browser download
      triggerDownload(data.filename, data.content, data.mimeType);
    } else if (data.type === 'assistant_message_chunk') {
      // Streaming chunk - could be intro text, intermediate thinking, OR final response
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].streaming) {
        // Append to existing streaming message
        const toolCalls = messages[messages.length - 1].toolCalls || [];
        const hasIncompletTools = toolCalls.some(call => !call.completed);

        if (inToolPhase && hasIncompletTools) {
          // This is intermediate "thinking" text between tool calls
          // Buffer it so we can attach it to the next tool call
          intermediateTextBuffer += data.content;
        } else if (inToolPhase) {
          // This is the final response after all tools complete
          messages[messages.length - 1].responseText = (messages[messages.length - 1].responseText || '') + data.content;
          messages = messages; // Trigger reactivity
        } else {
          // This is intro text before any tools
          messages[messages.length - 1].introText = (messages[messages.length - 1].introText || '') + data.content;
          messages = messages; // Trigger reactivity
        }
      } else {
        // Start new streaming message
        const messageId = `msg-${Date.now()}`;
        const newMessage = {
          role: 'assistant',
          streaming: true,
          id: messageId,
          introText: inToolPhase ? '' : data.content,
          toolCalls: [],
          responseText: inToolPhase ? data.content : ''
        };
        messages = [...messages, newMessage];
      }
    } else if (data.type === 'assistant_message') {
      if (data.done) {
        // Mark last message as complete
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          delete messages[messages.length - 1].streaming;
          messages = messages; // Trigger reactivity
        }
        inToolPhase = false;
        intermediateTextBuffer = ''; // Clear buffer when conversation ends
        waiting = false;
        showSpacer = false;
      } else {
        // Non-streaming message (fallback)
        const messageId = `msg-${Date.now()}`;
        messages = [...messages, {
          role: 'assistant',
          id: messageId,
          introText: inToolPhase ? '' : data.content,
          toolCalls: [],
          responseText: inToolPhase ? data.content : ''
        }];
        inToolPhase = false;
        waiting = false;
      }
    } else if (data.type === 'error') {
      error = data.error;
      waiting = false;
    }
  }

  let chatContainer;

  function handleSend(event) {
    const userMessage = event.detail.message;

    // Add user message to UI with unique ID
    const messageId = `msg-${Date.now()}`;
    messages = [...messages, { role: 'user', content: userMessage, id: messageId }];

    waiting = true;
    error = null;
    showSpacer = true;

    // Scroll the user message to top immediately after it's added
    tick().then(() => {
      const messageElement = document.getElementById(messageId);
      if (messageElement && chatContainer) {
        // Get current scroll position and element positions
        const containerRect = chatContainer.getBoundingClientRect();
        const messageRect = messageElement.getBoundingClientRect();

        // Calculate where the message currently is in the container
        const messageOffsetTop = chatContainer.scrollTop + (messageRect.top - containerRect.top);

        // Scroll so the message is at the top of the container with some offset
        const topOffset = 50; // Pixels from top of viewport
        chatContainer.scrollTo({
          top: messageOffsetTop - topOffset,
          behavior: 'smooth'
        });
      }
    });

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


</script>

<div class="chat-container">
  <div class="messages-wrapper" bind:this={chatContainer}>
    <div class="messages">
      {#if messages.length === 0}
        <div class="welcome">
          <h2>Berlin Simple Open Data</h2>
          <p>Finde und erkunde Daten aus dem Berliner Open Data Portal</p>
          {#if !connected}
            <div class="connection-status">
              <span class="status-dot"></span>
              Connecting to server...
            </div>
          {/if}
        </div>
      {/if}

      {#each messages as message, i (message.id || i)}
        {#if message.role === 'user'}
          <div id={message.id}>
            <Message role={message.role} content={message.content} />
          </div>
        {:else if message.role === 'assistant'}
          {#if message.introText}
            <Message role={message.role} content={message.introText} />
          {/if}
          {#if message.toolCalls && message.toolCalls.length > 0}
            <ToolActivity toolCalls={message.toolCalls} />
          {/if}
          {#if message.responseText}
            <Message role={message.role} content={message.responseText} />
          {/if}
        {/if}
      {/each}

      {#if waiting}
        <div class="loading">
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
        </div>
      {/if}

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <!-- Spacer to ensure there's always scroll space for messages to reach the top -->
      {#if showSpacer}
        <div class="scroll-spacer"></div>
      {/if}
    </div>
  </div>

  <div class="input-wrapper">
    <Input on:send={handleSend} disabled={!connected || waiting} />
  </div>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f9f9f9;
  }

  .messages-wrapper {
    flex: 1;
    overflow-y: auto;
    display: flex;
    justify-content: center;
  }

  .messages {
    width: 100%;
    max-width: 48rem;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0rem;
  }

  .scroll-spacer {
    /* Create scroll space equal to viewport height minus header/input */
    height: calc(100vh - 12rem);
    flex-shrink: 0;
  }

  .welcome {
    text-align: center;
    color: #6b7280;
    margin: auto;
    padding: 2rem;
  }

  .welcome h2 {
    color: #1a1a1a;
    font-size: 2rem;
    font-weight: 400;
    margin-bottom: 0.5rem;
  }

  .welcome p {
    font-size: 1rem;
    margin-bottom: 1.5rem;
  }

  .connection-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #9ca3af;
    margin-top: 1rem;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #fbbf24;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: #6b7280;
  }

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #9ca3af;
    animation: loading 1.4s ease-in-out infinite;
  }

  .loading-dot:nth-child(1) {
    animation-delay: 0s;
  }

  .loading-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes loading {
    0%, 80%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    40% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  .error-message {
    padding: 1rem;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #991b1b;
    font-size: 0.875rem;
  }

  .input-wrapper {
    display: flex;
    justify-content: center;
    border-top: 1px solid #e5e7eb;
    background: white;
    padding: 1rem;
  }
</style>
