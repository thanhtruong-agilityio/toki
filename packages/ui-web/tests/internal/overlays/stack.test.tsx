import { act, render } from "@testing-library/react";
import { Suspense, useEffect, useState, useTransition } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { nextOrder, useLayerOrder } from "../../../src/internal/overlays/stack";

afterEach(() => {
  suspend = false;
});

let suspend = false;
const never = new Promise<void>(() => {});

function Probe({ open, log }: { open: boolean; log: number[] }) {
  const order = useLayerOrder(open);
  // A render that reads the hook and then suspends is discarded.
  if (suspend && !open) throw never;
  useEffect(() => {
    log.push(order);
  });
  return null;
}

describe("useLayerOrder (R9)", () => {
  test("a render with open false that never commits does not change the order of a layer that stays open", async () => {
    const log: number[] = [];
    let start: (fn: () => void) => void = () => {};
    let setOpen: (open: boolean) => void = () => {};
    function Owner() {
      const [open, set] = useState(true);
      const [, startTransition] = useTransition();
      setOpen = set;
      start = startTransition;
      return (
        <Suspense fallback={null}>
          <Probe open={open} log={log} />
        </Suspense>
      );
    }
    render(<Owner />);
    const first = log[log.length - 1]!;
    expect(first).toBeGreaterThan(0);
    suspend = true;
    await act(async () => {
      start(() => setOpen(false));
    });
    suspend = false;
    // The transition render was discarded: the layer is still open and a
    // later layer must not get a lower order than it.
    const later = nextOrder();
    await act(async () => {
      setOpen(true);
    });
    expect(later).toBeGreaterThan(first);
    expect(log[log.length - 1]).toBe(first);
  });
});
