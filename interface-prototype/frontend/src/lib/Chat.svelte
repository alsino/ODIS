<!-- ABOUTME: Main chat container component -->
<!-- ABOUTME: Manages WebSocket connection and displays message history -->

<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import Message from './Message.svelte';
  import Input from './Input.svelte';
  import ToolActivity from './ToolActivity.svelte';

  let messages = [];
  // currentToolCalls tracks tool activity for the in-progress assistant response
  // Once the response is complete, these are attached to the assistant message
  let currentToolCalls = [];
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
    } else if (data.type === 'tool_call_start') {
      // Tool execution started - add to currentToolCalls for real-time display
      // The tool will show with a spinner in the ToolActivity component
      currentToolCalls = [...currentToolCalls, {
        id: data.toolCallId,
        name: data.toolName,
        args: data.toolArgs,
        completed: false
      }];
    } else if (data.type === 'tool_call_complete') {
      // Tool execution completed - update the tool call with results
      // The ToolActivity component will update from spinner to completed badge
      currentToolCalls = currentToolCalls.map(call =>
        call.id === data.toolCallId
          ? { ...call, completed: true, result: data.result, isError: data.isError }
          : call
      );
    } else if (data.type === 'assistant_message_chunk') {
      // Streaming chunk - append to last assistant message or create new one
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].streaming) {
        // Append to existing streaming message
        messages[messages.length - 1].content += data.content;
        messages = messages; // Trigger reactivity
      } else {
        // Start new streaming message - NOW trigger the scroll
        const messageId = `msg-${Date.now()}`;
        messages = [...messages, {
          role: 'assistant',
          content: data.content,
          streaming: true,
          id: messageId,
          toolCalls: [...currentToolCalls]
        }];

        // Trigger scroll to user question now that response is starting
        if (pendingScrollId) {
          scrollToId = pendingScrollId;
          pendingScrollId = null;
        }
      }
    } else if (data.type === 'assistant_message') {
      if (data.done) {
        // Mark last message as complete and attach final tool calls
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          delete messages[messages.length - 1].streaming;
          messages[messages.length - 1].toolCalls = [...currentToolCalls];
          messages = messages; // Trigger reactivity
        }
        currentToolCalls = [];
        waiting = false;
      } else {
        // Non-streaming message (fallback)
        const messageId = `msg-${Date.now()}`;
        messages = [...messages, {
          role: 'assistant',
          content: data.content,
          id: messageId,
          toolCalls: [...currentToolCalls]
        }];
        currentToolCalls = [];
        waiting = false;
      }
    } else if (data.type === 'error') {
      error = data.error;
      waiting = false;
    }
  }

  let chatContainer;
  let scrollToId = null;
  let pendingScrollId = null;

  function handleSend(event) {
    const userMessage = event.detail.message;

    // Add user message to UI with unique ID
    const messageId = `msg-${Date.now()}`;
    messages = [...messages, { role: 'user', content: userMessage, id: messageId }];

    // Don't scroll immediately - wait for response to start
    pendingScrollId = messageId;
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

  // Svelte action to scroll to a message
  function scrollToMessage(node) {
    if (!chatContainer) return;

    console.log('scrollToMessage action called');

    // Use a slight delay to ensure layout is complete
    const timeoutId = setTimeout(() => {
      console.log('Attempting scroll...');
      const containerRect = chatContainer.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();

      // Calculate target scroll position
      const targetScroll = chatContainer.scrollTop + (nodeRect.top - containerRect.top) - 50;

      console.log('Current scrollTop:', chatContainer.scrollTop);
      console.log('Target scrollTop:', targetScroll);

      chatContainer.scrollTop = targetScroll;

      console.log('After scroll, scrollTop:', chatContainer.scrollTop);

      scrollToId = null; // Clear the scroll target
    }, 50);

    return {
      destroy() {
        clearTimeout(timeoutId);
      }
    };
  }

</script>

<div class="chat-container">
  <div class="messages-wrapper" bind:this={chatContainer}>
    <div class="messages">
      {#if messages.length === 0}
        <div class="welcome">
          <h2>Berlin Simple Open Data (Soda)</h2>
          <p>Find and ask questions about Berlin's open datasets</p>
          {#if !connected}
            <div class="connection-status">
              <span class="status-dot"></span>
              Connecting to server...
            </div>
          {/if}
        </div>
      {/if}

      {#each messages as message, i (message.id || i)}
        {#if message.id && message.id === scrollToId}
          <div use:scrollToMessage>
            <Message role={message.role} content={message.content} />
            {#if message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0}
              <ToolActivity toolCalls={message.toolCalls} />
            {/if}
          </div>
        {:else}
          <Message role={message.role} content={message.content} />
          {#if message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0}
            <ToolActivity toolCalls={message.toolCalls} />
          {/if}
        {/if}
      {/each}

      {#if currentToolCalls.length > 0}
        <ToolActivity toolCalls={currentToolCalls} />
      {/if}

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
    gap: 1.5rem;
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
