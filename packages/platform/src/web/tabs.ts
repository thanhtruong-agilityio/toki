import type { Platform, TabMessage } from "../types";

const CHANNEL = "toki:tabs";

// The one shape that crosses tabs. Anything else is dropped before a listener
// sees it, and the delivered object is rebuilt so that no extra field passes.
function read(data: unknown): TabMessage | null {
  if (typeof data !== "object" || data === null) return null;
  return (data as { type?: unknown }).type === "signedOut"
    ? { type: "signedOut" }
    : null;
}

// Messages between the tabs of one browser, over one BroadcastChannel opened
// when the first listener subscribes or the first message is posted and closed
// when the last listener has gone. No method throws (R10): where the channel
// is absent or refuses, `post` does nothing and `subscribe` returns a no-op.
export function createTabs(): Platform["tabs"] {
  const listeners = new Set<(message: TabMessage) => void>();
  let channel: BroadcastChannel | null = null;

  function open(): BroadcastChannel | null {
    if (channel) return channel;
    try {
      if (typeof BroadcastChannel === "undefined") return null;
      const next = new BroadcastChannel(CHANNEL);
      next.onmessage = (event) => {
        const message = read(event.data);
        if (!message) return;
        for (const listener of [...listeners]) {
          try {
            listener({ ...message });
          } catch {
            // one listener failing never stops the others
          }
        }
      };
      channel = next;
      return next;
    } catch {
      return null;
    }
  }

  function close() {
    const current = channel;
    channel = null;
    try {
      current?.close();
    } catch {
      // already closed
    }
  }

  return {
    post(message) {
      const current = open();
      if (!current) return;
      try {
        current.postMessage({ type: message.type });
      } catch {
        // nothing to tell the other tabs
      }
      // With no listener here the channel is not kept; the message has been
      // handed to the browser before the close, which runs after this turn.
      // A listener may subscribe before the microtask runs: close only if none did.
      if (listeners.size === 0) {
        queueMicrotask(() => {
          if (listeners.size === 0) close();
        });
      }
    },
    subscribe(listener) {
      if (!open()) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) close();
      };
    },
  };
}
