import { defineConfig } from "vitest/config";

// jsdom for every file. src/current.test.ts opts into node with a docblock,
// so the interface entry is proved to load without a DOM (R4).
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
