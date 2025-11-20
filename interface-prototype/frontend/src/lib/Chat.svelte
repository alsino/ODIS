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
    } else if (data.type === 'assistant_message_chunk') {
      // Streaming chunk - append to last assistant message or create new one
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].streaming) {
        // Append to existing streaming message
        messages[messages.length - 1].content += data.content;
        messages = messages; // Trigger reactivity
      } else {
        // Start new streaming message
        messages = [...messages, { role: 'assistant', content: data.content, streaming: true }];
      }
    } else if (data.type === 'assistant_message') {
      if (data.done) {
        // Mark last message as complete
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          delete messages[messages.length - 1].streaming;
          messages = messages; // Trigger reactivity
        }
        waiting = false;
      } else {
        // Non-streaming message (fallback)
        messages = [...messages, { role: 'assistant', content: data.content }];
        waiting = false;
      }
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

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  let chatContainer;
  $: if (messages.length && chatContainer) {
    setTimeout(() => {
      // Check if user is near the bottom (within 100px)
      const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;

      // Only auto-scroll if user hasn't manually scrolled up
      if (isNearBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
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
        <p>Ask questions about Berlin's open datasets. For example:</p>
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
