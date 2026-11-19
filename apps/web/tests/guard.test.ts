import { describe, expect, test } from "vitest";
import { decideGuard, returnAddress, type GuardInput } from "../src/guard";

const ORIGIN = "https://toki.example.com";

describe("the return address (R3)", () => {
  test("a path of the app is kept, with its query and hash", () => {
    expect(returnAddress("/c/1", ORIGIN)).toBe("/c/1");
    expect(returnAddress("/c/1?tab=2#m", ORIGIN)).toBe("/c/1?tab=2#m");
    expect(returnAddress("/", ORIGIN)).toBe("/");
  });

  test.each([
    ["//other.example"],
    ["/\\other.example"],
    ["https://other.example"],
    ["https://toki.example.com/c/1"],
    ["/login"],
    ["/login?next=/c/1"],
    ["login"],
    [""],
    ["\\\\other.example"],
    ["/\t/other.example"],
    ["javascript:alert(1)"],
  ])("%j gives /", (next) => {
    expect(returnAddress(next, ORIGIN)).toBe("/");
  });

  test.each([[undefined], [null], [5], [{}], [["/c/1"]]])(
    "a value that is not text (%j) gives /",
    (next) => {
      expect(returnAddress(next, ORIGIN)).toBe("/");
    },
  );
});

function input(over: Partial<GuardInput>): GuardInput {
  return {
    status: "signedIn",
    everSignedIn: true,
    pathname: "/c/1",
    href: "/c/1?x=1",
    next: undefined,
    isPublic: false,
    origin: ORIGIN,
    ...over,
  };
}

describe("the guard (R1, R2, R40, R44)", () => {
  test("unknown: page background only, whatever the path", () => {
    expect(decideGuard(input({ status: "unknown" }))).toEqual({
      action: "wait",
    });
    expect(
      decideGuard(input({ status: "unknown", pathname: "/login" })),
    ).toEqual({ action: "wait" });
  });

  test("signed out: an app path goes to /login with the path as next", () => {
    expect(decideGuard(input({ status: "signedOut" }))).toEqual({
      action: "login",
      next: "/c/1?x=1",
    });
    expect(
      decideGuard(input({ status: "signedOut", pathname: "/", href: "/" })),
    ).toEqual({ action: "login", next: "/" });
  });

  test("signed out on /login: the page is shown", () => {
    expect(
      decideGuard(
        input({ status: "signedOut", pathname: "/login", href: "/login" }),
      ),
    ).toEqual({ action: "allow" });
  });

  test("signed in: an app path is shown; /login leaves for next or /", () => {
    expect(decideGuard(input({}))).toEqual({ action: "allow" });
    expect(decideGuard(input({ pathname: "/login", next: "/c/1" }))).toEqual({
      action: "leave",
      to: "/c/1",
    });
    expect(decideGuard(input({ pathname: "/login" }))).toEqual({
      action: "leave",
      to: "/",
    });
    expect(
      decideGuard(input({ pathname: "/login", next: "//other.example" })),
    ).toEqual({ action: "leave", to: "/" });
    expect(decideGuard(input({ pathname: "/login", next: "/login" }))).toEqual({
      action: "leave",
      to: "/",
    });
  });

  test("ended after the app was shown: the app stays under the cover", () => {
    expect(decideGuard(input({ status: "ended" }))).toEqual({
      action: "allow",
    });
  });

  test("ended when Toki was opened: page background only", () => {
    expect(
      decideGuard(input({ status: "ended", everSignedIn: false })),
    ).toEqual({ action: "cover" });
  });

  describe("a route with the flag public", () => {
    test("unknown still waits (R44)", () => {
      expect(decideGuard(input({ status: "unknown", isPublic: true }))).toEqual(
        { action: "wait" },
      );
    });

    test.each(["signedOut", "signedIn", "ended"] as const)(
      "%s is let through, with no next",
      (status) => {
        expect(
          decideGuard(
            input({ status, isPublic: true, pathname: "/join", href: "/join" }),
          ),
        ).toEqual({ action: "allow" });
      },
    );
  });
});
