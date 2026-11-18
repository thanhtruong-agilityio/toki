import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Providers } from "../test/providers";
import { setConnectionCheck } from "./online";
import { useOnlineGate } from "./useOnlineGate";

afterEach(() => setConnectionCheck(null));

function press(kind?: "action" | "undo") {
  let result: boolean | undefined;
  function Probe() {
    const { ensureOnline } = useOnlineGate();
    return <button onClick={() => (result = ensureOnline(kind))}>go</button>;
  }
  render(
    <Providers>
      <Probe />
    </Providers>,
  );
  act(() => screen.getByRole("button", { name: "go" }).click());
  return result;
}

describe("useOnlineGate (R17)", () => {
  it("returns true and shows nothing when the connection is up", () => {
    setConnectionCheck(() => true);
    expect(press()).toBe(true);
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it("returns true when the check throws", () => {
    setConnectionCheck(() => {
      throw new Error("boom");
    });
    expect(press()).toBe(true);
  });

  it("offline, an action shows common.offline.blocked and returns false", () => {
    setConnectionCheck(() => false);
    expect(press()).toBe(false);
    expect(
      screen.getByText(
        "You are offline. Try again when the connection is back.",
      ),
    ).toBeInTheDocument();
  });

  it("offline, an undo press shows common.offline.undoBlocked", () => {
    setConnectionCheck(() => false);
    expect(press("undo")).toBe(false);
    expect(
      screen.getByText("You are offline, so this was not undone."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Try again when/)).toBeNull();
  });

  it("ensureOnline keeps its identity from one render to the next", () => {
    const seen: unknown[] = [];
    function Spy() {
      seen.push(useOnlineGate().ensureOnline);
      return null;
    }
    const { rerender } = render(
      <Providers>
        <Spy />
      </Providers>,
    );
    rerender(
      <Providers>
        <Spy />
      </Providers>,
    );
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});
