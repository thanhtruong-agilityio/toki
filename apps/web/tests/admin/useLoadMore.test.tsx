// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoadMore } from "../../src/admin/useLoadMore";
import { installFakeIntersectionObserver } from "../support/fakeIntersection";

let io: ReturnType<typeof installFakeIntersectionObserver>;

beforeEach(() => {
  io = installFakeIntersectionObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({
  onMore,
  enabled = true,
  watch = 0,
  scroller = "auto",
}: {
  onMore: () => void;
  enabled?: boolean;
  watch?: number;
  scroller?: "auto" | "scroll" | "visible";
}) {
  const sentinel = useLoadMore(onMore, { enabled, watch });
  return (
    <div data-testid="outer" style={{ overflowY: "visible" }}>
      <div data-testid="scroller" style={{ overflowY: scroller }}>
        <div>
          <div ref={sentinel} data-testid="sentinel" />
        </div>
      </div>
    </div>
  );
}

describe("useLoadMore (TOKI-025 R9)", () => {
  it("watches the sentinel with the nearest scrolling ancestor as root and 48px at the bottom", () => {
    render(<Harness onMore={() => undefined} />);
    const [observer] = io.live();
    expect(observer?.root).toBe(screen.getByTestId("scroller"));
    expect(observer?.rootMargin).toBe("0px 0px 48px 0px");
    expect([...(observer?.observed ?? [])]).toEqual([
      screen.getByTestId("sentinel"),
    ]);
  });

  it("takes an ancestor whose overflow-y is scroll too", () => {
    render(<Harness onMore={() => undefined} scroller="scroll" />);
    expect(io.live()[0]?.root).toBe(screen.getByTestId("scroller"));
  });

  it("uses the viewport (root null) with the same margin when no ancestor scrolls", () => {
    render(<Harness onMore={() => undefined} scroller="visible" />);
    const [observer] = io.live();
    expect(observer?.root).toBeNull();
    expect(observer?.rootMargin).toBe("0px 0px 48px 0px");
  });

  it("asks for more when the sentinel comes into view, and not when it leaves", () => {
    const onMore = vi.fn();
    render(<Harness onMore={onMore} />);
    io.live()[0]?.trigger(false);
    expect(onMore).not.toHaveBeenCalled();
    io.live()[0]?.trigger(true);
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("watches nothing while it is not enabled", () => {
    render(<Harness onMore={() => undefined} enabled={false} />);
    expect(io.live()).toHaveLength(0);
  });

  it("makes a new observer when what it watches changes, so a sentinel still in view asks again", () => {
    const onMore = vi.fn();
    const { rerender } = render(<Harness onMore={onMore} watch={1} />);
    const first = io.live()[0];
    rerender(<Harness onMore={onMore} watch={2} />);
    expect(first?.disconnected).toBe(true);
    expect(io.live()).toHaveLength(1);
  });

  it("calls the latest function without making a new observer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness onMore={first} />);
    const observer = io.live()[0];
    rerender(<Harness onMore={second} />);
    expect(io.live()[0]).toBe(observer);
    observer?.trigger(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops watching when the page goes away", () => {
    const { unmount } = render(<Harness onMore={() => undefined} />);
    unmount();
    expect(io.live()).toHaveLength(0);
  });
});
