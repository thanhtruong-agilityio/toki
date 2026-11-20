import { describe, expect, it, vi } from "vitest";
import { createUuidV7Generator } from "../../src/ids/uuid-v7.js";

const PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function make(now: number, bytes: number[] | Uint8Array) {
  const randomBytes = vi.fn(() => Uint8Array.from(bytes));
  const next = createUuidV7Generator({
    clock: { now: () => now },
    randomBytes,
  });
  return { next, randomBytes };
}

const hex = (s: string) => s.split(" ").map((h) => parseInt(h, 16));

describe("createUuidV7Generator (R33)", () => {
  it("gives the RFC 9562 appendix B.2 example", () => {
    const { next } = make(1645557742000, hex("0c c3 18 c4 dc 0c 0c 07 39 8f"));
    expect(next()).toBe("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
  });

  it("maps clock 0 with ten ff bytes", () => {
    const { next } = make(0, new Array(10).fill(0xff));
    expect(next()).toBe("00000000-0000-7fff-bfff-ffffffffffff");
  });

  it("maps clock 0 with ten 00 bytes", () => {
    const { next } = make(0, new Array(10).fill(0));
    expect(next()).toBe("00000000-0000-7000-8000-000000000000");
  });

  it("maps the largest clock with ten 00 bytes", () => {
    const { next } = make(2 ** 48 - 1, new Array(10).fill(0));
    expect(next()).toBe("ffffffff-ffff-7000-8000-000000000000");
  });

  it("floors a fractional clock", () => {
    const bytes = hex("0c c3 18 c4 dc 0c 0c 07 39 8f");
    expect(make(1645557742000.9, bytes).next()).toBe(
      make(1645557742000, bytes).next(),
    );
  });

  it("asks randomBytes once per call for 10 bytes", () => {
    const { next, randomBytes } = make(5, new Array(10).fill(1));
    next();
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(randomBytes).toHaveBeenCalledWith(10);
  });

  it("makes 1000 distinct ids of the v7 form with a seeded source", () => {
    // mulberry32: a small seeded generator whose low bits are as good as its high bits.
    let seed = 12345;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
    const next = createUuidV7Generator({
      clock: { now: () => 1_700_000_000_000 },
      randomBytes: (n) => Uint8Array.from({ length: n }, () => rand() & 0xff),
    });
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const id = next();
      expect(id).toMatch(PATTERN);
      expect(id).toHaveLength(36);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
  });

  it.each([-1, 2 ** 48, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for the clock %s before asking for random bytes",
    (now) => {
      const { next, randomBytes } = make(now, new Array(10).fill(0));
      expect(next).toThrow(Error);
      expect(randomBytes).not.toHaveBeenCalled();
    },
  );

  it("throws when randomBytes returns fewer than 10 bytes", () => {
    const { next } = make(1, new Array(9).fill(0));
    expect(next).toThrow(Error);
  });
});
