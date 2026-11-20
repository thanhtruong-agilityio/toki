import { describe, expect, it, vi } from "vitest";
import { createUuidV7Generator } from "../../src/ids/uuid-v7.js";

const PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const bytes = (...hex: number[]) => Uint8Array.from(hex);
const filled = (value: number, length = 10) =>
  new Uint8Array(length).fill(value);

function make(now: number, random: Uint8Array) {
  const randomBytes = vi.fn<(length: number) => Uint8Array>(() => random);
  const generate = createUuidV7Generator({
    clock: { now: () => now },
    randomBytes,
  });
  return { generate, randomBytes };
}

describe("createUuidV7Generator (R1)", () => {
  it("makes the RFC 9562 appendix B.2 example", () => {
    const { generate } = make(
      1645557742000,
      bytes(0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f),
    );
    expect(generate()).toBe("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
  });

  it("makes the edge ids", () => {
    expect(make(0, filled(0xff)).generate()).toBe(
      "00000000-0000-7fff-bfff-ffffffffffff",
    );
    expect(make(0, filled(0)).generate()).toBe(
      "00000000-0000-7000-8000-000000000000",
    );
    expect(make(2 ** 48 - 1, filled(0)).generate()).toBe(
      "ffffffff-ffff-7000-8000-000000000000",
    );
  });

  it("floors a clock that returns a fraction", () => {
    const r = bytes(0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f);
    expect(make(1645557742000.9, r).generate()).toBe(
      make(1645557742000, r).generate(),
    );
  });

  it("asks for 10 random bytes, once per call", () => {
    const { generate, randomBytes } = make(5, filled(1));
    generate();
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(randomBytes).toHaveBeenCalledWith(10);
  });

  it("makes 1000 valid, different ids from a seeded source", () => {
    let seed = 12345;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    const generate = createUuidV7Generator({
      clock: { now: () => 1700000000000 },
      randomBytes: (length) => Uint8Array.from({ length }, () => next() & 0xff),
    });
    const ids = Array.from({ length: 1000 }, () => generate());
    for (const id of ids) expect(id).toMatch(PATTERN);
    expect(new Set(ids).size).toBe(1000);
  });

  it.each([-1, 2 ** 48, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for a clock of %s without asking for random bytes",
    (now) => {
      const { generate, randomBytes } = make(now, filled(0));
      expect(() => generate()).toThrow(Error);
      expect(randomBytes).not.toHaveBeenCalled();
    },
  );

  it("throws when the random source returns fewer than 10 bytes", () => {
    expect(() => make(1, filled(0, 9)).generate()).toThrow(Error);
  });
});
