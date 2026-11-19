import { describe, expect, it } from "vitest";
import { hashCode, newCode, newSecret, sha256 } from "./secrets.js";

describe("secrets", () => {
  it("draws a code of 6 decimal digits, leading zeros kept", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = newCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      seen.add(code[0]!);
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(newCode(() => 7)).toBe("000007");
    expect(newCode(() => 999999)).toBe("999999");
  });
  it("makes a secret of 32 random bytes as 43 base64url characters", () => {
    const a = newSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSecret()).not.toBe(a);
  });
  it("hashes with SHA-256 (known vector)", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("keys the code hash with the server secret and binds it to the requestId", () => {
    const k1 = "k".repeat(32);
    const k2 = "j".repeat(32);
    const h = hashCode(k1, "req", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode(k1, "req", "123456")).toBe(h);
    expect(hashCode(k2, "req", "123456")).not.toBe(h);
    expect(hashCode(k1, "other", "123456")).not.toBe(h);
    expect(hashCode(k1, "req", "123457")).not.toBe(h);
    expect(h).not.toBe(sha256("123456"));
  });
});
