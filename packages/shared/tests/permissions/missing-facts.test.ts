import { describe, expect, it } from "vitest";
import * as permissions from "../../src/permissions/index.js";
import { cases, permissionFunctions } from "./cases.js";
import type { FactPath } from "./cases.js";

const functions = permissionFunctions(permissions);

// The arguments with one fact replaced, or removed when `value` is REMOVE.
const REMOVE = Symbol("remove");
function withFact(args: unknown[], [arg, key]: FactPath, value: unknown) {
  const copy = [...args];
  if (key === null) {
    copy[arg] = value === REMOVE ? undefined : value;
    return copy;
  }
  const fact = { ...(copy[arg] as Record<string, unknown>) };
  if (value === REMOVE) delete fact[key];
  else fact[key] = value;
  copy[arg] = fact;
  return copy;
}

describe("missing facts deny (R4)", () => {
  it("has a case for every permission function, and no other", () => {
    expect(Object.keys(cases).sort()).toEqual(Object.keys(functions).sort());
  });

  describe.each(Object.entries(cases))("%s", (name, { args, facts }) => {
    const call = (callArgs: unknown[]) => functions[name]!(...callArgs);

    it("allows with every fact in place", () => {
      expect(call(args()).allowed).toBe(true);
    });

    // An object is the wrong type for every fact: they are strings, booleans
    // and a number.
    it.each(facts)("refuses when the fact [%i, %s] is missing", (arg, key) => {
      for (const value of [REMOVE, null, undefined, {}]) {
        expect(call(withFact(args(), [arg, key], value))).toEqual({
          allowed: false,
          reason: "fact_missing",
        });
      }
    });

    it.each(["guest", "owner"])("refuses the role %s", (role) => {
      expect(call(withFact(args(), [0, "role"], role))).toEqual({
        allowed: false,
        reason: "unknown_role",
      });
    });

    it("names a missing fact before an unknown role (R3)", () => {
      const guest = withFact(args(), [0, "role"], "guest");
      for (const path of facts.filter(([arg]) => arg !== 0)) {
        expect(call(withFact(guest, path, REMOVE))).toEqual({
          allowed: false,
          reason: "fact_missing",
        });
      }
    });
  });
});
