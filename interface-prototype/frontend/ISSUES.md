# Known Issues

This document tracks known issues, limitations, and problems encountered with the Interface Prototype frontend.

---

## Issue #1: Auto-scroll to User Question on Follow-up Not Working

**Status:** Open (TODO)
**Severity:** MEDIUM
**Date discovered:** 2025-11-20

**Description:**

When a user sends a follow-up question, the interface should automatically scroll to position the user's question at the top of the viewport (with ~50px offset), similar to Claude Desktop behavior. The assistant response should then stream below the fixed user question without additional scrolling during the streaming.

**Current behavior:**

The scroll either:
- Doesn't happen at all (scrollTop remains 0)
- Scrolls to wrong position (scrollTop gets capped at lower value than target)
- Happens at wrong time (before sufficient content exists in DOM)

**Console logs showing the problem:**

```
Current scrollTop: 0
Target scrollTop: 921.0156860351562
After scroll, scrollTop: 460.5555725097656
```

The scroll target is calculated correctly, but the final scrollTop is significantly lower than the target, suggesting the scroll is being capped by available content height.

**Root cause analysis:**

The fundamental issue appears to be a **timing problem with content availability**:

1. When user sends a message, it's added to the DOM
2. We attempt to scroll the user message to the top
3. BUT: The assistant response hasn't started streaming yet, so there's not enough content below the user message
4. The browser caps `scrollTop` at the maximum available scroll height
5. Even with delays (setTimeout, requestAnimationFrame, tick()), the timing is inconsistent

**Attempts made:**

Multiple approaches were tried over extensive debugging:

1. **Reactive statements** (`$:`) - Fired at wrong times, caused unwanted scrolling
2. **Svelte `tick()`** - Didn't wait long enough for layout completion
3. **`requestAnimationFrame`** - Still had timing issues
4. **`scrollIntoView()`** - Didn't work properly with scroll container hierarchy
5. **`offsetTop` calculation** - Values were 0 or incorrect before layout
6. **`getBoundingClientRect()` with timeouts** - Most reliable for calculation, but still timing issues
7. **Delayed scroll pattern** - Wait for first assistant chunk before scrolling:
   - Store message ID in `pendingScrollId` when user sends message
   - Trigger scroll (`scrollToId`) when first assistant chunk arrives
   - This ensures content exists, but still not working correctly

**Current implementation:**

Located in `/Users/alsino/Desktop/ODIS/interface-prototype/frontend/src/lib/Chat.svelte`:

```javascript
// Lines 104-105: State variables
let scrollToId = null;
let pendingScrollId = null;

// Lines 107-129: Store pending scroll on send
function handleSend(event) {
  const messageId = `msg-${Date.now()}`;
  messages = [...messages, { role: 'user', content: userMessage, id: messageId }];
  pendingScrollId = messageId; // Don't scroll yet
  // ...
}

// Lines 61-101: Trigger scroll when assistant response starts
function handleMessage(data) {
  if (data.type === 'assistant_message_chunk') {
    if (/* first chunk */) {
      if (pendingScrollId) {
        scrollToId = pendingScrollId;
        pendingScrollId = null;
      }
    }
  }
}

// Lines 132-161: Svelte action to perform scroll
function scrollToMessage(node) {
  setTimeout(() => {
    const containerRect = chatContainer.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetScroll = chatContainer.scrollTop + (nodeRect.top - containerRect.top) - 50;
    chatContainer.scrollTop = targetScroll;
    scrollToId = null;
  }, 50);
}
```

**Why this is hard:**

- Svelte's reactivity and DOM update timing is complex
- Need to coordinate between: message addition, DOM rendering, layout completion, and content streaming
- Scroll container hierarchy (`.messages-wrapper` scrolls, `.messages` contains content)
- WebSocket streaming means content arrives asynchronously
- Browser layout/paint cycles are not directly observable

**Potential solutions to explore:**

1. **Intersection Observer API** - Detect when elements enter viewport, might give better timing
2. **CSS scroll-behavior with scroll-margin** - Let browser handle scroll positioning
3. **MutationObserver** - Watch for DOM changes and scroll after content added
4. **ResizeObserver** - Detect when container height changes as content streams in
5. **Different scroll approach** - Instead of scrolling container, use CSS positioning/transforms
6. **Simplify to bottom-scroll** - Just always scroll to bottom (like most chat apps), abandon top-scroll behavior

**Priority:**

Medium - The chat is functional, but UX is degraded. Users can manually scroll to see their questions.

---

## Limitations

### Scroll Behavior

Currently, auto-scrolling to user questions on follow-up doesn't work reliably. Users must manually scroll to see their question and the streaming response.
