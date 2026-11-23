// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  AccountEntriesProvider,
  accountEntryIds,
  useAccountEntries,
  useRegisterAccountEntry,
  type AccountEntry,
} from "../../src/account/account-entries";

const item = (label: string, onSelect = () => {}): AccountEntry => ({
  label,
  onSelect,
});
const group = (heading: string, ...labels: string[]): AccountEntry => ({
  id: "g",
  heading,
  items: labels.map((label) => ({ label, onSelect: () => {} })),
});

function Registrant({
  id,
  entry,
}: {
  id: (typeof accountEntryIds)[number];
  entry: AccountEntry | null;
}) {
  useRegisterAccountEntry(id, entry);
  return null;
}

let seen: ReturnType<typeof useAccountEntries> = [];
let renders = 0;
function Consumer() {
  seen = useAccountEntries();
  renders += 1;
  return <span>{seen.length}</span>;
}
const wrap = (children: ReactNode) => (
  <AccountEntriesProvider>
    <Consumer />
    {children}
  </AccountEntriesProvider>
);
const labels = () =>
  seen.map((e) => ("items" in e ? `group:${e.heading}` : e.label));

describe("the closed list of ids (R3)", () => {
  test("is setStatus, pause, focus, preferences, signOut in this order", () => {
    expect([...accountEntryIds]).toEqual([
      "setStatus",
      "pause",
      "focus",
      "preferences",
      "signOut",
    ]);
  });
});

describe("the registry (R3)", () => {
  test("registration in the wrong order gives the fixed order", () => {
    renders = 0;
    render(
      wrap(
        <>
          <Registrant id="signOut" entry={item("Sign out")} />
          <Registrant id="focus" entry={group("Focus time", "25 min")} />
          <Registrant id="preferences" entry={item("Preferences")} />
          <Registrant id="setStatus" entry={item("Set status")} />
        </>,
      ),
    );
    expect(labels()).toEqual([
      "Set status",
      "group:Focus time",
      "Preferences",
      "Sign out",
    ]);
  });

  test("two registrations of one id leave the last", () => {
    render(
      wrap(
        <>
          <Registrant id="preferences" entry={item("First")} />
          <Registrant id="preferences" entry={item("Second")} />
        </>,
      ),
    );
    expect(labels()).toEqual(["Second"]);
  });

  test("an unmount removes the entry, and only when it is still the registered one", () => {
    function App({ first, second }: { first: boolean; second: boolean }) {
      return wrap(
        <>
          {first && <Registrant id="preferences" entry={item("First")} />}
          {second && <Registrant id="preferences" entry={item("Second")} />}
        </>,
      );
    }
    const { rerender } = render(<App first second />);
    expect(labels()).toEqual(["Second"]);
    // the first one leaves: the second is still the registered one
    rerender(<App first={false} second />);
    expect(labels()).toEqual(["Second"]);
    rerender(<App first={false} second={false} />);
    expect(labels()).toEqual([]);
  });

  test("null removes", () => {
    const { rerender } = render(
      wrap(<Registrant id="preferences" entry={item("P")} />),
    );
    expect(labels()).toEqual(["P"]);
    rerender(wrap(<Registrant id="preferences" entry={null} />));
    expect(labels()).toEqual([]);
  });

  test("a shape that does not fit its id is ignored", () => {
    render(
      wrap(
        <>
          <Registrant id="signOut" entry={group("G", "a")} />
          <Registrant id="pause" entry={item("Pause as an item")} />
          <Registrant id="preferences" entry={item("P")} />
        </>,
      ),
    );
    expect(labels()).toEqual(["P"]);
  });

  test("a change of label is shown", () => {
    const { rerender } = render(
      wrap(<Registrant id="preferences" entry={item("One")} />),
    );
    rerender(wrap(<Registrant id="preferences" entry={item("Two")} />));
    expect(labels()).toEqual(["Two"]);
  });

  test("the entry given holds the latest onSelect without a re-render of the consumers", () => {
    const calls: string[] = [];
    function Host() {
      const [n, setN] = useState(0);
      return (
        <>
          <button onClick={() => setN(n + 1)}>again</button>
          <Registrant
            id="signOut"
            entry={item("Sign out", () => calls.push(`call-${n}`))}
          />
        </>
      );
    }
    renders = 0;
    render(wrap(<Host />));
    const after = renders;
    for (let i = 0; i < 10; i += 1) {
      act(() => screen.getByText("again").click());
    }
    expect(renders - after).toBe(0);
    expect(renders).toBeLessThanOrEqual(2);
    const first = seen[0] as { onSelect: (e: unknown) => void };
    first.onSelect({});
    expect(calls).toEqual(["call-10"]);
  });

  test("the onSelect of a group option is the latest too and receives the event", () => {
    const got = vi.fn();
    const g: AccountEntry = {
      id: "focus",
      heading: "Focus time",
      items: [{ label: "25 min", onSelect: got }],
    };
    render(wrap(<Registrant id="focus" entry={g} />));
    const entry = seen[0] as Extract<AccountEntry, { items: unknown[] }>;
    const event = { type: "click" };
    entry.items[0]!.onSelect(event as never);
    expect(got).toHaveBeenCalledWith(event);
  });

  test("with no provider a registration does nothing and the list is empty", () => {
    function Alone() {
      useRegisterAccountEntry("signOut", item("x"));
      return <span>{useAccountEntries().length}</span>;
    }
    render(<Alone />);
    expect(screen.getByText("0")).toBeTruthy();
  });
});
