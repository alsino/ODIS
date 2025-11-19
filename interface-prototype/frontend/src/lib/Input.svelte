<!-- ABOUTME: Message input component with send button -->
<!-- ABOUTME: Handles user input and sends messages to parent -->

<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let inputValue = '';
  let disabled = false;

  export { disabled };

  function handleSubmit(e) {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      dispatch('send', { message: inputValue.trim() });
      inputValue = '';
    }
  }

  function handleKeyDown(e) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }
</script>

<form class="input-container" on:submit={handleSubmit}>
  <textarea
    bind:value={inputValue}
    on:keydown={handleKeyDown}
    placeholder="Type your message..."
    {disabled}
    rows="1"
  />
  <button type="submit" disabled={!inputValue.trim() || disabled}>
    Send
  </button>
</form>

<style>
  .input-container {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #ddd;
    background: white;
  }

  textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
    resize: none;
    min-height: 44px;
    max-height: 200px;
  }

  textarea:focus {
    outline: none;
    border-color: #1976d2;
  }

  textarea:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  button {
    padding: 0.75rem 1.5rem;
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: #1565c0;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
</style>
