import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";

describe("ApiError (R4)", () => {
  it("holds the kind, status, code, message, details and requestId of an http error", () => {
    const error = new ApiError({
      kind: "http",
      status: 500,
      code: "internal_error",
      message: "Something broke.",
      details: { requestId: "req-1", x: 1 },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("http");
    expect(error.status).toBe(500);
    expect(error.code).toBe("internal_error");
    expect(error.message).toBe("Something broke.");
    expect(error.details).toEqual({ requestId: "req-1", x: 1 });
    expect(error.requestId).toBe("req-1");
  });

  it("has no requestId when details has none or it is not a string", () => {
    expect(
      new ApiError({ kind: "http", status: 500, details: { requestId: 3 } })
        .requestId,
    ).toBeNull();
    expect(new ApiError({ kind: "http", status: 500 }).requestId).toBeNull();
    expect(
      new ApiError({ kind: "http", status: 500, details: "x" }).requestId,
    ).toBeNull();
  });

  it("gives code, details and status null, and a fixed English message, for the other kinds", () => {
    for (const kind of ["network", "timeout", "aborted"] as const) {
      const error = new ApiError({ kind });
      expect(error.status).toBeNull();
      expect(error.code).toBeNull();
      expect(error.details).toBeNull();
      expect(error.requestId).toBeNull();
      expect(error.message.length).toBeGreaterThan(0);
    }
    const invalid = new ApiError({ kind: "invalid_response", status: 200 });
    expect(invalid.status).toBe(200);
    expect(invalid.code).toBeNull();
  });

  it("holds nothing of a request: its JSON has only the six fields", () => {
    const error = new ApiError({
      kind: "http",
      status: 400,
      code: "validation_failed",
      message: "Bad.",
    });
    const json = JSON.parse(JSON.stringify(error)) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(
      ["code", "details", "kind", "message", "requestId", "status"].sort(),
    );
  });
});
