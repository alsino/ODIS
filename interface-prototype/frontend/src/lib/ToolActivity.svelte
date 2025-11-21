<!-- ABOUTME: Tool activity component showing tool execution status and results -->
<!-- ABOUTME: Displays active tools as status indicators and completed tools as expandable badges -->

<!--
  Hybrid tool activity display:

  DURING EXECUTION:
  - Shows active tools with animated spinner
  - Displays friendly tool name (e.g., "Searching Berlin Datasets...")
  - Multiple tools can be shown simultaneously

  AFTER COMPLETION:
  - Shows collapsible badge: "🔧 Used X tools"
  - Clicking expands to show details for each tool:
    - Tool name and error status
    - Input arguments (JSON)
    - Results or error message

  PROPS:
  - toolCalls: Array of tool call objects
    - id: unique identifier
    - name: tool name (snake_case from MCP)
    - args: arguments object
    - completed: boolean
    - result: result text (if completed)
    - isError: boolean (if completed with error)
-->

<script>
  export let toolCalls = [];

  let expandedCalls = new Set();

  function toggleExpanded(id) {
    if (expandedCalls.has(id)) {
      expandedCalls.delete(id);
    } else {
      expandedCalls.add(id);
    }
    expandedCalls = expandedCalls;
  }

  // Convert snake_case to Title Case for display
  function formatToolName(name) {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Reactive statements to separate active and completed tool calls
  $: activeCalls = toolCalls.filter(call => !call.completed);
  $: completedCalls = toolCalls.filter(call => call.completed);
</script>

{#if activeCalls.length > 0}
  <div class="active-tools">
    {#each activeCalls as call}
      <div class="active-tool">
        <span class="spinner"></span>
        <span>{formatToolName(call.name)}...</span>
      </div>
    {/each}
  </div>
{/if}

{#if completedCalls.length > 0}
  <div class="completed-tools">
    <button
      class="tools-badge"
      on:click={() => toggleExpanded('all')}
    >
      <span class="badge-icon">🔧</span>
      <span class="badge-text">Used {completedCalls.length} tool{completedCalls.length > 1 ? 's' : ''}</span>
      <span class="expand-icon">{expandedCalls.has('all') ? '▼' : '▶'}</span>
    </button>

    <div class="tool-details-wrapper" class:expanded={expandedCalls.has('all')}>
      <div class="tool-details">
        {#each completedCalls as call}
          <div class="tool-call" class:error={call.isError}>
            <div class="tool-header">
              <span class="tool-name">{formatToolName(call.name)}</span>
              {#if call.isError}
                <span class="error-badge">Error</span>
              {/if}
            </div>

            {#if call.args}
              <details class="tool-section">
                <summary>Arguments</summary>
                <pre class="tool-content">{JSON.stringify(call.args, null, 2)}</pre>
              </details>
            {/if}

            {#if call.result}
              <details class="tool-section" open>
                <summary>Result</summary>
                <div class="tool-content result">{call.result}</div>
              </details>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .active-tools {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    margin: 0.5rem 0;
    background: #f3f4f6;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #4b5563;
  }

  .active-tool {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .completed-tools {
    margin: 0.5rem 0;
    padding: 0.75rem 1rem;
    background: #f9f9f9;
  }

  .tools-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tools-badge:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .badge-icon {
    font-size: 1rem;
  }

  .badge-text {
    font-weight: 500;
  }

  .expand-icon {
    font-size: 0.75rem;
    margin-left: auto;
  }

  .tool-details-wrapper {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
    overflow: hidden;
  }

  .tool-details-wrapper.expanded {
    grid-template-rows: 1fr;
  }

  .tool-details {
    min-height: 0;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tool-call {
    padding: 0.75rem;
    background: white;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  .tool-call.error {
    border-color: #fecaca;
    background: #fef2f2;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .tool-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.875rem;
  }

  .error-badge {
    padding: 0.125rem 0.5rem;
    background: #fee2e2;
    color: #991b1b;
    font-size: 0.75rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .tool-section {
    margin-top: 0.5rem;
  }

  .tool-section summary {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    user-select: none;
    padding: 0.25rem 0;
  }

  .tool-section summary:hover {
    color: #374151;
  }

  .tool-content {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    color: #374151;
    overflow-x: auto;
  }

  .tool-content.result {
    white-space: pre-wrap;
    word-break: break-word;
  }

  pre.tool-content {
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    line-height: 1.5;
  }
</style>
