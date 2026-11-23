// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  ListActionsProvider,
  useListActions,
  useRegisterListActions,
  type ListAction,
} from "../../src/conversation-list/list-actions";

function Registrar({
  actions,
}: {
  actions: { browseChannels?: ListAction; startDirect?: ListAction } | null;
}) {
  useRegisterListActions(actions);
  return null;
}

function Reader() {
  const actions = useListActions();
  return (
    <p data-testid="names">
      {Object.keys(actions)
        .filter((k) => (actions as Record<string, unknown>)[k] !== undefined)
        .sort()
        .join(",")}
    </p>
  );
}

const names = () => screen.getByTestId("names").textContent;

describe("the registry of the three openers (R25)", () => {
  test("nothing is registered until a component registers", () => {
    render(
      <ListActionsProvider>
        <Reader />
      </ListActionsProvider>,
    );
    expect(names()).toBe("");
  });

  test("useListActions reads the registered names, and unmount removes them", () => {
    const browse = vi.fn();
    const start = vi.fn();
    function Page({ show }: { show: boolean }) {
      return (
        <ListActionsProvider>
          <Reader />
          {show ? (
            <Registrar
              actions={{ browseChannels: browse, startDirect: start }}
            />
          ) : null}
        </ListActionsProvider>
      );
    }
    const { rerender } = render(<Page show />);
    expect(names()).toBe("browseChannels,startDirect");
    rerender(<Page show={false} />);
    expect(names()).toBe("");
  });

  test("a name that is not given is not registered, and null removes", () => {
    const browse = vi.fn();
    function Page({ on }: { on: boolean }) {
      return (
        <ListActionsProvider>
          <Reader />
          <Registrar actions={on ? { browseChannels: browse } : null} />
        </ListActionsProvider>
      );
    }
    const { rerender } = render(<Page on />);
    expect(names()).toBe("browseChannels");
    rerender(<Page on={false} />);
    expect(names()).toBe("");
  });

  test("the wrapper calls the latest function given, with the options", () => {
    const first = vi.fn();
    const second = vi.fn();
    let call: ListAction | undefined;
    function Grab() {
      call = useListActions().startDirect;
      return null;
    }
    function Page({ fn }: { fn: ListAction }) {
      return (
        <ListActionsProvider>
          <Grab />
          <Registrar actions={{ startDirect: fn }} />
        </ListActionsProvider>
      );
    }
    const { rerender } = render(<Page fn={first} />);
    const wrapper = call;
    rerender(<Page fn={second} />);
    expect(call).toBe(wrapper);
    const returnFocusRef = createRef<HTMLElement>();
    call!({ returnFocusRef });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ returnFocusRef });
  });

  test("the last registration wins, and an unmount removes only the opener still registered", () => {
    const a = vi.fn();
    const b = vi.fn();
    let call: ListAction | undefined;
    function Grab() {
      call = useListActions().browseChannels;
      return null;
    }
    function Page({ withA, withB }: { withA: boolean; withB: boolean }) {
      return (
        <ListActionsProvider>
          <Grab />
          {withA ? <Registrar actions={{ browseChannels: a }} /> : null}
          {withB ? <Registrar actions={{ browseChannels: b }} /> : null}
        </ListActionsProvider>
      );
    }
    const { rerender } = render(<Page withA withB={false} />);
    rerender(<Page withA withB />);
    call!();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    // A leaves while B is the registered one: B stays.
    rerender(<Page withA={false} withB />);
    expect(call).toBeDefined();
    call!();
    expect(b).toHaveBeenCalledTimes(2);
    rerender(<Page withA={false} withB={false} />);
    expect(call).toBeUndefined();
  });

  test("new functions at every render do not re-render the provider or its readers", () => {
    let renders = 0;
    function Probe() {
      renders += 1;
      useListActions();
      return null;
    }
    function Churn() {
      const [n, setN] = useState(0);
      useRegisterListActions({
        browseChannels: () => void n,
        startDirect: () => void n,
      });
      return <button onClick={() => setN(n + 1)}>again</button>;
    }
    const children = (
      <>
        <Probe />
        <Churn />
      </>
    );
    render(<ListActionsProvider>{children}</ListActionsProvider>);
    // One render to mount, at most one more when the two names become registered.
    expect(renders).toBeLessThanOrEqual(2);
    const settled = renders;
    for (let i = 0; i < 5; i++) {
      act(() => screen.getByText("again").click());
    }
    expect(renders).toBe(settled);
  });
});
