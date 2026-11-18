import type { StorageArea } from "../types";

const PREFIX = "toki:";

// One area over a browser store. The store is read on every call, inside a
// try: even reading `localStorage` can throw when site data is blocked.
// No method throws (R9).
function area(getStore: () => Storage): StorageArea {
  return {
    get(key) {
      try {
        return getStore().getItem(PREFIX + key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        getStore().setItem(PREFIX + key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        getStore().removeItem(PREFIX + key);
      } catch {
        // refused: nothing to remove
      }
    },
    clear() {
      try {
        const store = getStore();
        const ours: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key !== null && key.startsWith(PREFIX)) ours.push(key);
        }
        for (const key of ours) store.removeItem(key);
      } catch {
        // refused: nothing to clear
      }
    },
  };
}

export function createStorage(): { device: StorageArea; tab: StorageArea } {
  return {
    device: area(() => localStorage),
    tab: area(() => sessionStorage),
  };
}
