<!-- ABOUTME: Individual message bubble component -->
<!-- ABOUTME: Displays user or assistant messages with appropriate styling -->

<script>
  import { marked } from 'marked';

  export let role = 'user'; // 'user' or 'assistant'
  export let content = '';

  // Parse markdown to HTML
  $: htmlContent = marked.parse(content);
</script>

<div class="message {role}">
  <div class="message-role">{role === 'user' ? 'You' : 'Assistant'}</div>
  <div class="message-content">
    {@html htmlContent}
  </div>
</div>

<style>
  .message {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    max-width: 80%;
  }

  .message.user {
    background-color: #e3f2fd;
    margin-left: auto;
    text-align: right;
  }

  .message.assistant {
    background-color: #f5f5f5;
    margin-right: auto;
  }

  .message-role {
    font-size: 0.75rem;
    font-weight: 600;
    color: #666;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
  }

  .message-content {
    word-wrap: break-word;
    line-height: 1.6;
  }

  /* Markdown styling */
  .message-content :global(h1) {
    font-size: 1.75rem;
    font-weight: 700;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: #1976d2;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 0.5rem;
  }

  .message-content :global(h2) {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    color: #1976d2;
  }

  .message-content :global(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    color: #424242;
  }

  .message-content :global(h4) {
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
    color: #424242;
  }

  .message-content :global(p) {
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  .message-content :global(ul),
  .message-content :global(ol) {
    margin-top: 0.5rem;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  .message-content :global(li) {
    margin-bottom: 0.25rem;
  }

  .message-content :global(strong) {
    font-weight: 600;
    color: #212121;
  }

  .message-content :global(em) {
    font-style: italic;
  }

  .message-content :global(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.9em;
  }

  .message-content :global(pre) {
    background-color: #2d2d2d;
    color: #f8f8f2;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin-top: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .message-content :global(pre code) {
    background-color: transparent;
    padding: 0;
    color: inherit;
  }

  .message-content :global(a) {
    color: #1976d2;
    text-decoration: none;
  }

  .message-content :global(a:hover) {
    text-decoration: underline;
  }

  .message-content :global(blockquote) {
    border-left: 4px solid #e0e0e0;
    padding-left: 1rem;
    margin-left: 0;
    margin-right: 0;
    color: #666;
    font-style: italic;
  }

  .message-content :global(hr) {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 1rem 0;
  }

  .message-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75rem 0;
  }

  .message-content :global(th),
  .message-content :global(td) {
    border: 1px solid #e0e0e0;
    padding: 0.5rem;
    text-align: left;
  }

  .message-content :global(th) {
    background-color: rgba(0, 0, 0, 0.05);
    font-weight: 600;
  }
</style>
