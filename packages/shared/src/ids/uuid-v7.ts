import type { Clock } from "../clock/clock.js";

// UUIDv7 (RFC 9562 section 5.7) from a clock and a random source that the caller passes in: this
// file reads neither the system time nor a random source itself (TOKI-008 R19, TOKI-002 rule 1).
// Ids made in the same millisecond are not promised to sort in the order they were made.

export interface UuidV7Sources {
  clock: Clock;
  /** Returns a `Uint8Array` of `length` random bytes. */
  randomBytes(length: number): Uint8Array;
}

const MAX_TIMESTAMP = 2 ** 48 - 1;
const RANDOM_LENGTH = 10;

export function createUuidV7Generator({
  clock,
  randomBytes,
}: UuidV7Sources): () => string {
  return () => {
    const t = Math.floor(clock.now());
    if (!Number.isFinite(t) || t < 0 || t > MAX_TIMESTAMP) {
      throw new Error(`UUIDv7: the clock returned ${t}, outside 0 to 2^48 - 1`);
    }
    const r = randomBytes(RANDOM_LENGTH);
    if (r.length < RANDOM_LENGTH) {
      throw new Error(
        `UUIDv7: the random source returned ${r.length} bytes, 10 are needed`,
      );
    }

    const b = new Uint8Array(16);
    // 48 bits of t, big-endian. Division, not shifts: shifts work on 32 bits.
    let rest = t;
    for (let i = 5; i >= 0; i--) {
      b[i] = rest % 256;
      rest = Math.floor(rest / 256);
    }
    b[6] = 0x70 | (r[0]! & 0x0f);
    b[7] = r[1]!;
    b[8] = 0x80 | (r[2]! & 0x3f);
    for (let i = 3; i < RANDOM_LENGTH; i++) b[6 + i] = r[i]!;

    const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}
