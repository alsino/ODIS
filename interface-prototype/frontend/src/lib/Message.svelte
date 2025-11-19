<!-- ABOUTME: Individual message bubble component -->
<!-- ABOUTME: Displays user or assistant messages with appropriate styling -->

<script>
  export let role = 'user'; // 'user' or 'assistant'
  export let content = '';
</script>

<div class="message {role}">
  <div class="message-role">{role === 'user' ? 'You' : 'Assistant'}</div>
  <div class="message-content">{content}</div>
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
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
