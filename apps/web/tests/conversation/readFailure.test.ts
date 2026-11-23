import { ApiError } from "@toki/client-core";
import { describe, expect, test } from "vitest";
import { readFailure } from "../../src/conversation/readFailure";

const http = (status: number, code: string | null = null) =>
  new ApiError({ kind: "http", status, code });

// R14: what a failed read or write leads to, from the kind that `classifyApiError` gives.
describe("readFailure (R14)", () => {
  test.each([
    ["403", http(403), "no_access"],
    ["404", http(404), "no_access"],
    ["401 of a session", http(401, "session_ended"), "none"],
    ["aborted", new ApiError({ kind: "aborted" }), "none"],
    [
      "invalid_response",
      new ApiError({ kind: "invalid_response" }),
      "unreadable",
    ],
    ["409", http(409), "retry"],
    ["429", http(429), "retry"],
    ["500", http(500), "retry"],
    ["400", http(400), "retry"],
    ["network", new ApiError({ kind: "network" }), "retry"],
    ["timeout", new ApiError({ kind: "timeout" }), "retry"],
    ["something that is not an ApiError", new Error("x"), "retry"],
  ])("%s", (_name, error, expected) => {
    expect(readFailure(error)).toBe(expected);
  });
});
