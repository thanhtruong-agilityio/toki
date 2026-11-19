import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// 32 random bytes, base64url: a session secret or a requestId (R23).
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

// 6 decimal digits, leading zeros kept, from a cryptographic source (R3).
// `draw` is replaceable by a test only.
export function newCode(
  draw: () => number = () => randomInt(0, 1_000_000),
): string {
  return String(draw()).padStart(6, "0");
}

// HMAC-SHA-256 of the requestId and the code, keyed with the server secret
// (Hashing in the spec): the database alone cannot be used to find a code.
export function hashCode(key: string, requestId: string, code: string): string {
  return createHmac("sha256", key).update(`${requestId}:${code}`).digest("hex");
}
