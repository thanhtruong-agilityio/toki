import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs with `globals` off, so Testing Library registers neither its
// cleanup nor the act flag by itself (R27).
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});

// jsdom has no scrolling; the router asks for it on every navigation.
if (typeof window !== "undefined") window.scrollTo = () => {};
