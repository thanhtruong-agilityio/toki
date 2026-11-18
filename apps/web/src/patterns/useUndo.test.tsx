import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "../test/providers";
import { setConnectionCheck } from "./online";
import {
  UNDO_KEY_LIMIT,
  rememberToastKey,
  useUndo,
  type UndoOutcome,
} from "./useUndo";

type Run = ReturnType<typeof useUndo>["run"];
let run!: Run;
const runs: Run[] = [];

function Harness({ onMount }: { onMount?: () => void }) {
  const api = useUndo();
  run = api.run;
  runs.push(api.run);
  useEffect(() => onMount?.(), [onMount]);
  return null;
}

function setup() {
  return render(
    <Providers>
      <Harness />
    </Providers>,
  );
}

async function start(args: Partial<Parameters<Run>[0]> = {}) {
  let outcome: UndoOutcome | undefined;
  await act(async () => {
    outcome = await run({
      action: "pinMessage",
      text: "Pinned to conversation",
      perform: vi.fn(),
      undo: vi.fn(),
      ...args,
    });
  });
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers();
  runs.length = 0;
});
afterEach(() => {
  setConnectionCheck(null);
  vi.useRealTimers();
});

const undoButton = () => screen.queryByRole("button", { name: "Undo" });

describe("run: order and outcomes (R12)", () => {
  it("performs, then shows the toast with Undo, and resolves done", async () => {
    setup();
    const order: string[] = [];
    const perform = vi.fn(() => {
      order.push("perform");
      expect(screen.queryByText("Pinned to conversation")).toBeNull();
    });
    expect(await start({ perform })).toBe("done");
    expect(perform).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pinned to conversation")).toBeInTheDocument();
    expect(undoButton()).toBeInTheDocument();
  });

  it("a synchronous perform shows the toast before any timer runs", async () => {
    setup();
    await start();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(undoButton()).toBeInTheDocument();
  });

  it("waits for an asynchronous perform before it shows the toast", async () => {
    setup();
    let finish!: () => void;
    const perform = () => new Promise<void>((r) => (finish = r));
    let outcome: UndoOutcome | undefined;
    await act(async () => {
      void run({
        action: "pinMessage",
        text: "Pinned to conversation",
        perform,
        undo: vi.fn(),
      }).then((o) => (outcome = o));
    });
    expect(screen.queryByText("Pinned to conversation")).toBeNull();
    await act(async () => finish());
    expect(outcome).toBe("done");
    expect(screen.getByText("Pinned to conversation")).toBeInTheDocument();
  });

  it("a perform that throws or rejects gives a plain toast, no Undo, and failed", async () => {
    setup();
    expect(
      await start({
        perform: () => {
          throw new Error("boom");
        },
      }),
    ).toBe("failed");
    expect(
      screen.getByText("That did not work. Try again."),
    ).toBeInTheDocument();
    expect(undoButton()).toBeNull();
    expect(
      await start({ perform: () => Promise.reject(new Error("boom")) }),
    ).toBe("failed");
  });

  it("offline resolves blocked, performs nothing and shows no Undo", async () => {
    setup();
    setConnectionCheck(() => false);
    const perform = vi.fn();
    expect(await start({ perform })).toBe("blocked");
    expect(perform).not.toHaveBeenCalled();
    expect(undoButton()).toBeNull();
    expect(
      screen.getByText(
        "You are offline. Try again when the connection is back.",
      ),
    ).toBeInTheDocument();
  });

  it("a wrong id throws synchronously, before a promise exists and before anything is done", () => {
    setup();
    const perform = vi.fn();
    let returned: unknown = "unset";
    expect(() => {
      returned = run({
        // @ts-expect-error a confirm id is not an undo id
        action: "archiveChannel",
        text: "x",
        perform,
        undo: vi.fn(),
      });
    }).toThrow(/archiveChannel.*confirm|confirm.*archiveChannel/);
    expect(returned).toBe("unset");
    expect(perform).not.toHaveBeenCalled();
    expect(screen.queryByText("x")).toBeNull();
  });

  it("an action that asks nothing is refused too", () => {
    setup();
    expect(() =>
      run({
        // @ts-expect-error deleteUnsentMessage has no pattern
        action: "deleteUnsentMessage",
        text: "x",
        perform: vi.fn(),
        undo: vi.fn(),
      }),
    ).toThrow(/deleteUnsentMessage/);
  });
});

describe("Undo (R13)", () => {
  it("calls undo once, the Toast having removed itself, and shows nothing when it works", async () => {
    setup();
    const undo = vi.fn();
    await start({ undo });
    await act(async () => fireEvent.click(undoButton()!));
    expect(undo).toHaveBeenCalledTimes(1);
    // The Toast dismisses itself before it calls onPress (TOKI-013 R24).
    expect(undoButton()).toBeNull();
    expect(screen.queryByText("Could not undo. Try again.")).toBeNull();
    expect(screen.queryByText("Pinned to conversation")).toBeNull();
  });

  it("offline, Undo calls nothing and says it was not undone", async () => {
    setup();
    const undo = vi.fn();
    await start({ undo });
    setConnectionCheck(() => false);
    await act(async () => fireEvent.click(undoButton()!));
    expect(undo).not.toHaveBeenCalled();
    expect(
      screen.getByText("You are offline, so this was not undone."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Try again when/)).toBeNull();
  });

  it("a failing undo gives one plain toast", async () => {
    setup();
    await start({ undo: () => Promise.reject(new Error("boom")) });
    await act(async () => fireEvent.click(undoButton()!));
    expect(screen.getByText("Could not undo. Try again.")).toBeInTheDocument();
  });
});

describe("time (R14)", () => {
  it("the toast is there 1 ms before 5000 ms and gone at 5000 ms", async () => {
    setup();
    const undo = vi.fn();
    await start({ undo });
    act(() => void vi.advanceTimersByTime(4999));
    expect(undoButton()).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(undoButton()).toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });

  it("useUndo.ts calls no timer", () => {
    const source = readFileSync(resolve(__dirname, "useUndo.ts"), "utf8");
    expect(source).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });
});

describe("key (R15)", () => {
  it("the same key dismisses the earlier toast, a different key does not", async () => {
    setup();
    await start({ text: "first", key: "m1" });
    await start({ text: "second", key: "m1" });
    expect(screen.queryByText("first")).toBeNull();
    expect(screen.getByText("second")).toBeInTheDocument();
    await start({ text: "third", key: "m2" });
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("third")).toBeInTheDocument();
    await start({ text: "fourth" });
    await start({ text: "fifth" });
    // no key: nothing is dismissed by key (the Toast keeps at most three)
    expect(screen.getByText("fifth")).toBeInTheDocument();
  });

  it("an entry whose toast has expired causes no error when the key comes again", async () => {
    setup();
    await start({ text: "first", key: "m1" });
    act(() => void vi.advanceTimersByTime(5000));
    expect(await start({ text: "again", key: "m1" })).toBe("done");
    expect(screen.getByText("again")).toBeInTheDocument();
  });

  it("60 calls with different keys keep working, and the latest key is still replaced", async () => {
    setup();
    for (let i = 0; i < 60; i++) await start({ text: `t${i}`, key: `k${i}` });
    await start({ text: "again", key: "k59" });
    expect(screen.queryByText("t59")).toBeNull();
    expect(screen.getByText("again")).toBeInTheDocument();
  });

  it("the map keeps the 50 most recent keys", () => {
    const map = new Map<string, number>();
    for (let i = 0; i < 60; i++) rememberToastKey(map, `k${i}`, i);
    expect(UNDO_KEY_LIMIT).toBe(50);
    expect(map.size).toBe(50);
    expect(map.has("k0")).toBe(false);
    expect(map.has("k59")).toBe(true);
    rememberToastKey(map, "k10", 99);
    expect(map.size).toBe(50);
    expect([...map.keys()].at(-1)).toBe("k10");
  });
});

describe("identity and lifetime (R16)", () => {
  it("run is the same function from one render to the next", () => {
    const { rerender } = setup();
    rerender(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(runs.length).toBeGreaterThan(1);
    expect(new Set(runs).size).toBe(1);
  });

  it("an Undo that is shown still works after the starting component unmounted", async () => {
    const undo = vi.fn();
    function Starter() {
      const { run } = useUndo();
      const [alive, setAlive] = useState(true);
      return alive ? (
        <>
          <button
            onClick={() =>
              void run({
                action: "pinMessage",
                text: "Pinned to conversation",
                perform: () => {},
                undo,
              })
            }
          >
            go
          </button>
          <button onClick={() => setAlive(false)}>unmount</button>
        </>
      ) : null;
    }
    render(
      <Providers>
        <Starter />
      </Providers>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "go" })),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "unmount" })),
    );
    expect(undoButton()).toBeInTheDocument();
    await act(async () => fireEvent.click(undoButton()!));
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
