import { describe, expect, it } from "vitest";
import { classifyApiError } from "./classify";
import { ApiError } from "./errors";

const http = (status: number, code: string | null = null) =>
  new ApiError({ kind: "http", status, code });

describe("classifyApiError (R8)", () => {
  it.each([
    [http(401, "unauthenticated"), "unauthenticated"],
    [http(401, "session_ended"), "unauthenticated"],
    [http(401, "account_deactivated"), "unauthenticated"],
    [http(401, "invalid_code"), "unknown"],
    [http(401), "unknown"],
    [http(400, "validation_failed"), "field"],
    [http(403), "no_access"],
    [http(404), "no_access"],
    [http(409), "fresh_copy"],
    [http(410), "fresh_copy"],
    [http(429), "wait"],
    [http(500), "retry"],
    [http(502), "retry"],
    [http(503), "retry"],
    [http(418), "unknown"],
    [http(399), "unknown"],
    [new ApiError({ kind: "network" }), "retry"],
    [new ApiError({ kind: "timeout" }), "retry"],
    [new ApiError({ kind: "invalid_response", status: 200 }), "unreadable"],
    [new ApiError({ kind: "aborted" }), "ignore"],
  ] as const)("%#: %s", (error, expected) => {
    expect(classifyApiError(error)).toBe(expected);
  });

  it("returns unknown for a value that is not an ApiError", () => {
    expect(classifyApiError(new Error("x"))).toBe("unknown");
    expect(classifyApiError(null)).toBe("unknown");
    expect(classifyApiError({ kind: "http", status: 500 })).toBe("unknown");
  });
});
