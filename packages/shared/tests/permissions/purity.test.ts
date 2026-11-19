import { afterEach, describe, expect, it, vi } from "vitest";
import * as permissions from "../../src/permissions/index.js";
import { cases, permissionFunctions } from "./cases.js";

const functions = permissionFunctions(permissions);

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(Object.entries(cases))("%s is pure (R3)", (name, { args }) => {
  const call = (callArgs: unknown[]) => functions[name]!(...callArgs);

  it("does not change its arguments and gives the same result twice", () => {
    const frozen = deepFreeze(args());
    const before = JSON.stringify(frozen);
    const result = call(frozen);
    expect(call(frozen)).toEqual(result);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("reads no clock, no random number and no network", () => {
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    const fetched = vi.spyOn(globalThis, "fetch");
    call(args());
    call([]);
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(fetched).not.toHaveBeenCalled();
  });

  it("does not throw, whatever takes the place of an argument", () => {
    const good = args();
    expect(call([]).allowed).toBe(false);
    for (let arg = 0; arg < good.length; arg += 1) {
      for (const junk of [undefined, null, 7, "x", [], () => 1]) {
        const callArgs = [...good];
        callArgs[arg] = junk;
        expect(typeof call(callArgs).allowed).toBe("boolean");
      }
    }
  });
});
