// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, test } from "vitest";
import {
  PanelOutlet,
  ShellSlotsProvider,
  useShellPanel,
  useShellPanelState,
} from "../../src/shell/shell-slots";

// A stand-in for AppShellRoute: it reads the provider's state and gives one stable outlet.
let routeRenders = 0;
const outlet = <PanelOutlet />;
function FakeRoute({ children }: { children?: ReactNode }) {
  routeRenders += 1;
  const state = useShellPanelState();
  return (
    <div>
      <p data-testid="owner">{state === null ? "none" : "set"}</p>
      <p data-testid="label">{state?.label ?? ""}</p>
      <aside data-testid="panel">{state === null ? null : outlet}</aside>
      {children}
    </div>
  );
}

function Page({
  label = "Details",
  content = "body",
  on = true,
}: {
  label?: string;
  content?: ReactNode;
  on?: boolean;
}) {
  useShellPanel(on ? { label, content } : null);
  return null;
}

function mount(page: ReactNode) {
  routeRenders = 0;
  return render(
    <ShellSlotsProvider>
      <FakeRoute>{page}</FakeRoute>
    </ShellSlotsProvider>,
  );
}

const panel = () => screen.getByTestId("panel");

describe("the side panel slot (R26)", () => {
  test("no panel until a page sets one", () => {
    mount(null);
    expect(screen.getByTestId("owner")).toHaveTextContent("none");
    expect(panel()).toBeEmptyDOMElement();
  });

  test("a page opens the panel with the name and the content", () => {
    mount(<Page label="Details" content={<b>hello</b>} />);
    expect(screen.getByTestId("owner")).toHaveTextContent("set");
    expect(screen.getByTestId("label")).toHaveTextContent("Details");
    expect(panel()).toHaveTextContent("hello");
  });

  test("passing null closes it", () => {
    const { rerender } = mount(<Page />);
    expect(panel()).toHaveTextContent("body");
    rerender(
      <ShellSlotsProvider>
        <FakeRoute>
          <Page on={false} />
        </FakeRoute>
      </ShellSlotsProvider>,
    );
    expect(screen.getByTestId("owner")).toHaveTextContent("none");
    expect(panel()).toBeEmptyDOMElement();
  });

  test("unmounting closes it", () => {
    const { rerender } = mount(<Page />);
    rerender(
      <ShellSlotsProvider>
        <FakeRoute />
      </ShellSlotsProvider>,
    );
    expect(screen.getByTestId("owner")).toHaveTextContent("none");
    expect(panel()).toBeEmptyDOMElement();
  });

  test("two pages: the last call wins, and the first leaving keeps the last", () => {
    const both = (a: boolean) => (
      <ShellSlotsProvider>
        <FakeRoute>
          {a ? <Page label="A" content="from A" /> : null}
          <Page label="B" content="from B" />
        </FakeRoute>
      </ShellSlotsProvider>
    );
    const { rerender } = render(both(true));
    expect(screen.getByTestId("label")).toHaveTextContent("B");
    expect(panel()).toHaveTextContent("from B");
    rerender(both(false));
    expect(screen.getByTestId("label")).toHaveTextContent("B");
    expect(panel()).toHaveTextContent("from B");
  });

  test("the later page leaving gives the panel back to the earlier one, and the earlier leaving closes it", () => {
    const both = (a: boolean, b: boolean) => (
      <ShellSlotsProvider>
        <FakeRoute>
          {a ? <Page label="A" content="from A" /> : null}
          {b ? <Page label="B" content="from B" /> : null}
        </FakeRoute>
      </ShellSlotsProvider>
    );
    const { rerender } = render(both(true, false));
    rerender(both(true, true));
    expect(screen.getByTestId("label")).toHaveTextContent("B");
    expect(panel()).toHaveTextContent("from B");
    rerender(both(true, false));
    expect(screen.getByTestId("owner")).toHaveTextContent("set");
    expect(screen.getByTestId("label")).toHaveTextContent("A");
    expect(panel()).toHaveTextContent("from A");
    rerender(both(false, false));
    expect(screen.getByTestId("owner")).toHaveTextContent("none");
    expect(panel()).toBeEmptyDOMElement();
  });

  test("a new label renames the panel", () => {
    const { rerender } = mount(<Page label="One" />);
    rerender(
      <ShellSlotsProvider>
        <FakeRoute>
          <Page label="Two" />
        </FakeRoute>
      </ShellSlotsProvider>,
    );
    expect(screen.getByTestId("label")).toHaveTextContent("Two");
  });

  test("a page with an inline content that renders ten times renders the route at most twice, and the last content shows", () => {
    function Churning() {
      const [n, setN] = useState(0);
      useShellPanel({ label: "Details", content: <i>count {n}</i> });
      return <button onClick={() => setN((v) => v + 1)}>again</button>;
    }
    mount(<Churning />);
    for (let i = 0; i < 10; i++) {
      act(() => screen.getByText("again").click());
    }
    expect(routeRenders).toBeLessThanOrEqual(2);
    expect(panel()).toHaveTextContent("count 10");
  });

  test("the provider's state does not change when only the content changes", () => {
    const seen: unknown[] = [];
    function Spy() {
      seen.push(useShellPanelState());
      return null;
    }
    function Churning() {
      const [n, setN] = useState(0);
      useShellPanel({ label: "Details", content: <i>{n}</i> });
      return <button onClick={() => setN((v) => v + 1)}>again</button>;
    }
    const children = (
      <>
        <Spy />
        <Churning />
      </>
    );
    render(<ShellSlotsProvider>{children}</ShellSlotsProvider>);
    const settled = seen.length;
    const state = seen[seen.length - 1];
    for (let i = 0; i < 5; i++) {
      act(() => screen.getByText("again").click());
    }
    // A reader of the state is not rendered again and holds the same object.
    expect(seen.length).toBe(settled);
    expect(seen[seen.length - 1]).toBe(state);
  });
});
