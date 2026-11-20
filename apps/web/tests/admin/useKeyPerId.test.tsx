// @vitest-environment jsdom
import { ApiError } from "@toki/client-core";
import { renderHook } from "@testing-library/react";
import { IDEMPOTENCY_KEY_PATTERN } from "@toki/shared";
import { describe, expect, it } from "vitest";
import { useKeyPerId } from "../../src/admin/useKeyPerId";

const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code });

describe("useKeyPerId (TOKI-025 R20, R22)", () => {
  it("makes a key at the first use and gives the same one again", () => {
    const { result } = renderHook(() => useKeyPerId());
    const first = result.current.keyFor("inv-1");
    expect(first).toHaveLength(36);
    expect(first).toMatch(IDEMPOTENCY_KEY_PATTERN);
    expect(result.current.keyFor("inv-1")).toBe(first);
  });

  it("gives each id its own key", () => {
    const { result } = renderHook(() => useKeyPerId());
    expect(result.current.keyFor("inv-1")).not.toBe(
      result.current.keyFor("inv-2"),
    );
  });

  it("drops the key after a success, so the next press makes a new one", () => {
    const { result } = renderHook(() => useKeyPerId());
    const first = result.current.keyFor("inv-1");
    result.current.succeeded("inv-1");
    expect(result.current.keyFor("inv-1")).not.toBe(first);
  });

  it.each([
    ["a timeout", new ApiError({ kind: "timeout" })],
    ["a network error", new ApiError({ kind: "network" })],
    ["a 5xx", http(500, "internal_error")],
    ["a 409 request_in_progress", http(409, "request_in_progress")],
  ])("keeps the key after %s", (_name, error) => {
    const { result } = renderHook(() => useKeyPerId());
    const first = result.current.keyFor("inv-1");
    result.current.failed("inv-1", error);
    expect(result.current.keyFor("inv-1")).toBe(first);
  });

  it.each([
    ["a 409 idempotency_key_reused", http(409, "idempotency_key_reused")],
    ["a 400", http(400, "validation_failed")],
    ["a 404", http(404, "not_found")],
    ["a 403", http(403, "forbidden")],
  ])("drops the key after %s", (_name, error) => {
    const { result } = renderHook(() => useKeyPerId());
    const first = result.current.keyFor("inv-1");
    result.current.failed("inv-1", error);
    expect(result.current.keyFor("inv-1")).not.toBe(first);
  });

  it("drops a key on request, as when the text of the invite form changes", () => {
    const { result } = renderHook(() => useKeyPerId());
    const first = result.current.keyFor("invite");
    result.current.drop("invite");
    expect(result.current.keyFor("invite")).not.toBe(first);
  });

  it("keeps the other ids' keys when one is dropped", () => {
    const { result } = renderHook(() => useKeyPerId());
    const other = result.current.keyFor("inv-2");
    result.current.keyFor("inv-1");
    result.current.succeeded("inv-1");
    expect(result.current.keyFor("inv-2")).toBe(other);
  });
});
