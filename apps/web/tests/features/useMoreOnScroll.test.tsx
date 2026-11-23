// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useMoreOnScroll } from "../../src/features/useMoreOnScroll";

function List({
  onMore,
  enabled = true,
}: {
  onMore: () => void;
  enabled?: boolean;
}) {
  const more = useMoreOnScroll({ onMore, enabled });
  return (
    <div data-testid="box" {...more}>
      <ul>
        <li>
          <button type="button">first</button>
        </li>
        <li>
          <button type="button">last</button>
        </li>
      </ul>
    </div>
  );
}

function size(el: HTMLElement, top: number, client: number, height: number) {
  Object.defineProperty(el, "scrollTop", { value: top, configurable: true });
  Object.defineProperty(el, "clientHeight", {
    value: client,
    configurable: true,
  });
  Object.defineProperty(el, "scrollHeight", {
    value: height,
    configurable: true,
  });
}

describe("useMoreOnScroll (TOKI-034 R8)", () => {
  test("asks when the end is within 48 px and not before", () => {
    const onMore = vi.fn();
    render(<List onMore={onMore} />);
    const box = screen.getByTestId("box");
    size(box, 0, 360, 1000);
    fireEvent.scroll(box);
    expect(onMore).not.toHaveBeenCalled();
    size(box, 592, 360, 1000); // 952 = 1000 - 48
    fireEvent.scroll(box);
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  test("asks when focus enters the last row, not the first", () => {
    const onMore = vi.fn();
    render(<List onMore={onMore} />);
    screen.getByText("first").focus();
    expect(onMore).not.toHaveBeenCalled();
    screen.getByText("last").focus();
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  test("asks nothing while disabled", () => {
    const onMore = vi.fn();
    render(<List onMore={onMore} enabled={false} />);
    const box = screen.getByTestId("box");
    size(box, 700, 360, 1000);
    fireEvent.scroll(box);
    screen.getByText("last").focus();
    expect(onMore).not.toHaveBeenCalled();
  });
});
