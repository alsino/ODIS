<!-- ABOUTME: Message input component with auto-growing textarea -->
<!-- ABOUTME: Handles user input and sends messages to parent -->

<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let inputValue = 'Gibt es Daten zu Berliner Kitas?';
  let disabled = false;
  let textarea;

  export { disabled };

  function handleSubmit(e) {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      dispatch('send', { message: inputValue.trim() });
      inputValue = '';
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }
  }

  function handleKeyDown(e) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleInput() {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }
</script>

<form class="input-container" on:submit={handleSubmit}>
  <div class="input-wrapper">
    <textarea
      bind:this={textarea}
      bind:value={inputValue}
      on:keydown={handleKeyDown}
      on:input={handleInput}
      placeholder="Ask about Berlin datasets..."
      {disabled}
      rows="1"
    />
    <button type="submit" disabled={!inputValue.trim() || disabled} aria-label="Send message">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 10L17 3L11 17L9 11L3 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</form>

<style>
  .input-container {
    width: 100%;
    max-width: 48rem;
    padding: 0;
  }

  .input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.75rem;
    transition: border-color 0.2s;
  }

  .input-wrapper:focus-within {
    border-color: #9ca3af;
  }

  textarea {
    flex: 1;
    padding: 0.5rem 0;
    border: none;
    font-family: inherit;
    font-size: 1rem;
    resize: none;
    min-height: 24px;
    max-height: 200px;
    line-height: 1.5;
    color: #1a1a1a;
  }

  textarea:focus {
    outline: none;
  }

  textarea::placeholder {
    color: #9ca3af;
  }

  textarea:disabled {
    background-color: transparent;
    cursor: not-allowed;
    color: #9ca3af;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background-color: #1a1a1a;
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  button:hover:not(:disabled) {
    background-color: #374151;
  }

  button:disabled {
    background-color: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
  }
</style>
