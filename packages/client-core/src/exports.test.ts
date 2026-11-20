import { describe, expect, it } from "vitest";
import * as mod from "./index";

// R1: the package exports these names from src/index.ts.
describe("the exports of client-core (R1)", () => {
  it.each([
    "createApiClient",
    "ApiError",
    "classifyApiError",
    "createConversationStore",
    "foldSearchText",
  ])("exports %s", (name) => {
    expect(typeof (mod as Record<string, unknown>)[name]).toBe("function");
  });
});
