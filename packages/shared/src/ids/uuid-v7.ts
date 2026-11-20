import type { Clock } from "../clock/clock.js";

export interface UuidV7Sources {
  /** The clock of TOKI-008; this file reads no system time itself. */
  clock: Clock;
  /** Returns `length` random bytes; this file reads no random source itself. */
  randomBytes(length: number): Uint8Array;
}

const RANDOM_BYTES = 10;
const MAX_TIMESTAMP = 2 ** 48 - 1;

const hex = (byte: number) => byte.toString(16).padStart(2, "0");

// A UUID version 7 (RFC 9562 section 5.7): 48 bits of epoch milliseconds, then
// 74 random bits with the version and variant bits set (TOKI-025 R33). Ids made
// in one millisecond are not promised to sort in the order they were made.
export function createUuidV7Generator({
  clock,
  randomBytes,
}: UuidV7Sources): () => string {
  return () => {
    const t = Math.floor(clock.now());
    if (!Number.isFinite(t) || t < 0 || t > MAX_TIMESTAMP) {
      throw new Error("uuid v7: the clock is outside 0 to 2^48 - 1");
    }
    const r = randomBytes(RANDOM_BYTES);
    if (r.length < RANDOM_BYTES) {
      throw new Error("uuid v7: not enough random bytes");
    }
    const bytes = new Uint8Array(16);
    // Bytes 0 to 5: the 48 bits of t, big-endian. Divide, as a shift would cut at 32 bits.
    for (let i = 0; i < 6; i += 1) {
      bytes[5 - i] = Math.floor(t / 2 ** (8 * i)) % 256;
    }
    bytes[6] = 0x70 | ((r[0] as number) & 0x0f);
    bytes[7] = r[1] as number;
    bytes[8] = 0x80 | ((r[2] as number) & 0x3f);
    for (let i = 9; i < 16; i += 1) bytes[i] = r[i - 6] as number;
    const h = Array.from(bytes, hex).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}
