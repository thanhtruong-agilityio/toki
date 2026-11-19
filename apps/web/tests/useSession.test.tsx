// @vitest-environment jsdom
import {
  createSessionStore,
  markSignedIn,
  markSignedOut,
  type SessionUser,
} from "@toki/client-core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useSession } from "../src/useSession";

const user: SessionUser = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  role: "member",
  language: "en",
};

describe("useSession (R39)", () => {
  test("follows the session state of client-core, one render per change", () => {
    markSignedOut();
    let renders = 0;
    const { result, unmount } = renderHook(() => {
      renders += 1;
      return useSession();
    });
    expect(result.current).toEqual({ status: "signedOut" });
    const before = renders;
    act(() => markSignedIn(user));
    expect(result.current).toEqual({ status: "signedIn", user });
    expect(renders).toBe(before + 1);
    act(() => markSignedOut());
    expect(result.current).toEqual({ status: "signedOut" });
    unmount();
  });

  test("after unmounting a change renders nothing more", () => {
    markSignedOut();
    let renders = 0;
    const { unmount } = renderHook(() => {
      renders += 1;
      return useSession();
    });
    unmount();
    const after = renders;
    act(() => markSignedIn(user));
    expect(renders).toBe(after);
    markSignedOut();
  });

  test("a store of its own is a separate state", () => {
    expect(createSessionStore().getSessionState()).toEqual({
      status: "unknown",
    });
  });
});
