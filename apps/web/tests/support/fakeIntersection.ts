import { vi } from "vitest";

// A fake `IntersectionObserver` that records its options and fires when a test says so
// (TOKI-025 Testing). Every observer made since `install` is in `instances`.
export type FakeObserver = {
  callback: IntersectionObserverCallback;
  root: Element | Document | null;
  rootMargin: string;
  observed: Set<Element>;
  disconnected: boolean;
  trigger(isIntersecting: boolean): void;
};

export function installFakeIntersectionObserver() {
  const instances: FakeObserver[] = [];

  class Fake {
    readonly instance: FakeObserver;
    constructor(
      callback: IntersectionObserverCallback,
      init: IntersectionObserverInit = {},
    ) {
      const instance: FakeObserver = {
        callback,
        root: init.root ?? null,
        rootMargin: init.rootMargin ?? "0px",
        observed: new Set(),
        disconnected: false,
        trigger: (isIntersecting) => {
          for (const target of instance.observed) {
            callback(
              [{ isIntersecting, target } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
          }
        },
      };
      this.instance = instance;
      instances.push(instance);
    }
    observe(target: Element) {
      this.instance.observed.add(target);
    }
    unobserve(target: Element) {
      this.instance.observed.delete(target);
    }
    disconnect() {
      this.instance.disconnected = true;
      this.instance.observed.clear();
    }
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal("IntersectionObserver", Fake);
  return {
    instances,
    // The observers that are still watching something.
    live: () => instances.filter((i) => !i.disconnected),
  };
}
