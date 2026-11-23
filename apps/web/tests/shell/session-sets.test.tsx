// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, test } from "vitest";
import {
  SessionSetsProvider,
  useSessionSets,
  type SessionSets,
} from "../../src/shell/session-sets";

function grab(into: SessionSets[]) {
  return function Grab() {
    into.push(useSessionSets());
    return null;
  };
}

describe("the sets of one session (R21, R32)", () => {
  test("two readers share the same sets, and the value does not change between renders", () => {
    const a: SessionSets[] = [];
    const b: SessionSets[] = [];
    const A = grab(a);
    const B = grab(b);
    const { rerender } = render(
      <SessionSetsProvider>
        <A />
        <B />
      </SessionSetsProvider>,
    );
    rerender(
      <SessionSetsProvider>
        <A />
        <B />
      </SessionSetsProvider>,
    );
    expect(a[0]).toBe(b[0]);
    expect(a[a.length - 1]).toBe(a[0]);
  });

  test("clear empties both sets", () => {
    const got: SessionSets[] = [];
    const G = grab(got);
    render(
      <SessionSetsProvider>
        <G />
      </SessionSetsProvider>,
    );
    const sets = got[0]!;
    sets.seen.add("a");
    sets.memberChecked.add("b");
    sets.clear();
    expect(sets.seen.size).toBe(0);
    expect(sets.memberChecked.size).toBe(0);
  });

  test("a remount of the tree under the provider keeps what was added", () => {
    const got: SessionSets[] = [];
    const G = grab(got);
    const { rerender } = render(
      <StrictMode>
        <SessionSetsProvider>
          <G />
        </SessionSetsProvider>
      </StrictMode>,
    );
    got[0]!.seen.add("kept");
    rerender(
      <StrictMode>
        <SessionSetsProvider>
          <div>
            <G />
          </div>
        </SessionSetsProvider>
      </StrictMode>,
    );
    expect(got[got.length - 1]!.seen.has("kept")).toBe(true);
  });
});
