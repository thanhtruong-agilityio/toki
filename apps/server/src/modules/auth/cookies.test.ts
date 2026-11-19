import { describe, expect, it } from "vitest";
import {
  clearedCookie,
  cookieName,
  isDevelopment,
  readCookie,
  sessionCookie,
} from "./cookies.js";

describe("cookies (R21, R26)", () => {
  it("treats only an explicit development value as development", () => {
    expect(isDevelopment("development")).toBe(true);
    for (const v of [undefined, "", "production", "dev", "Development"]) {
      expect(isDevelopment(v)).toBe(false);
    }
  });
  it("sets the attributes of production: __Host- name, Secure, no Domain", () => {
    const c = sessionCookie("abc", false);
    expect(c).toBe(
      "__Host-toki_session=abc; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax; Secure",
    );
    expect(c).not.toContain("Domain");
  });
  it("drops Secure and the prefix only in development", () => {
    const c = sessionCookie("abc", true);
    expect(c).toBe(
      "toki_session=abc; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
    );
    expect(cookieName(true)).toBe("toki_session");
  });
  it("clears with the same name, Path, Secure and Max-Age=0", () => {
    expect(clearedCookie(false)).toBe(
      "__Host-toki_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure",
    );
    expect(clearedCookie(true)).toContain("toki_session=;");
    expect(clearedCookie(true)).toContain("Max-Age=0");
  });
  it("reads only the expected name, the first duplicate, and skips malformed pairs", () => {
    const n = "__Host-toki_session";
    expect(readCookie(`a=1; ${n}=v1; b=2`, n)).toBe("v1");
    expect(readCookie(`${n}=first; ${n}=second`, n)).toBe("first");
    expect(readCookie(`garbage; ;=x; ${n}=ok`, n)).toBe("ok");
    expect(readCookie("toki_session=dev", n)).toBeNull();
    expect(readCookie(undefined, n)).toBeNull();
    expect(readCookie(`${n}=`, n)).toBeNull();
  });
});
