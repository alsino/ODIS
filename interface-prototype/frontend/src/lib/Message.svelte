<!-- ABOUTME: Individual message component -->
<!-- ABOUTME: Displays user or assistant messages with appropriate styling -->

<script>
  import { marked } from 'marked';

  export let role = 'user'; // 'user' or 'assistant'
  export let content = '';

  // Parse markdown to HTML
  $: htmlContent = marked.parse(content);
</script>

<div class="message {role}">
  <div class="message-content">
    {@html htmlContent}
  </div>
</div>

<style>
  .message {
    width: 100%;
    padding: 1.5rem 1rem;
  }

  .message.user {
    background-color: white;
  }

  .message.assistant {
    background-color: #f9f9f9;
  }

  .message-content {
    word-wrap: break-word;
    line-height: 1.7;
    font-size: 1rem;
    color: #1a1a1a;
  }

  /* Markdown styling */
  .message-content :global(h1) {
    font-size: 1.875rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    color: #111827;
    line-height: 1.3;
  }

  .message-content :global(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: #111827;
    line-height: 1.3;
  }

  .message-content :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    color: #374151;
    line-height: 1.4;
  }

  .message-content :global(h4) {
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    color: #374151;
    line-height: 1.4;
  }

  .message-content :global(p) {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .message-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .message-content :global(ul),
  .message-content :global(ol) {
    margin-top: 0.75rem;
    margin-bottom: 1rem;
    padding-left: 1.75rem;
  }

  .message-content :global(li) {
    margin-bottom: 0.5rem;
  }

  .message-content :global(li > p) {
    margin-bottom: 0.5rem;
  }

  .message-content :global(strong) {
    font-weight: 600;
    color: #111827;
  }

  .message-content :global(em) {
    font-style: italic;
  }

  .message-content :global(code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;
    font-size: 0.875em;
    color: #1f2937;
  }

  .message-content :global(pre) {
    background-color: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-top: 0.75rem;
    margin-bottom: 1rem;
  }

  .message-content :global(pre code) {
    background-color: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.875rem;
  }

  .message-content :global(a) {
    color: #2563eb;
    text-decoration: none;
  }

  .message-content :global(a:hover) {
    text-decoration: underline;
  }

  .message-content :global(blockquote) {
    border-left: 3px solid #d1d5db;
    padding-left: 1rem;
    margin-left: 0;
    margin-right: 0;
    color: #6b7280;
  }

  .message-content :global(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1.5rem 0;
  }

  .message-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
    font-size: 0.875rem;
  }

  .message-content :global(th),
  .message-content :global(td) {
    border: 1px solid #e5e7eb;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  .message-content :global(th) {
    background-color: #f9fafb;
    font-weight: 600;
    color: #374151;
  }

  .message-content :global(td) {
    color: #1f2937;
  }
</style>
