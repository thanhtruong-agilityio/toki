// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  PeoplePicker,
  type PeoplePickerProps,
} from "../../../src/features/people/PeoplePicker";

const people = Array.from({ length: 120 }, (_, i) => ({
  id: `p${i + 1}`,
  displayName: `Person ${String(i + 1).padStart(3, "0")}`,
  hue: i,
}));

// A parent that holds `selected`, as the dialogs do.
function Harness(
  props: Partial<PeoplePickerProps> & { onChangeSpy?: (ids: string[]) => void },
) {
  const [selected, setSelected] = useState<string[]>([
    ...(props.selected ?? []),
  ]);
  const { onChangeSpy, selected: _initial, ...rest } = props;
  void _initial;
  return (
    <PeoplePicker
      people={people}
      selected={selected}
      onChange={(ids) => {
        onChangeSpy?.(ids);
        setSelected(ids);
      }}
      limitMessage="Up to 8 people, counting you"
      searchLabel="Search people"
      emptyText="No people match"
      removeLabel={(name) => `Remove ${name}`}
      {...rest}
    />
  );
}

const rowsOf = () => screen.getAllByRole("button", { pressed: false });

describe("PeoplePicker (TOKI-034 R18 to R20)", () => {
  test("renders the field, the search input and the list", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("div.field.pk")).not.toBeNull();
    const input = screen.getByRole("searchbox", { name: "Search people" });
    expect(input).toHaveAttribute("data-autofocus");
    expect(container.querySelector("div.mlist.people ul")).not.toBeNull();
  });

  test("pressing a row adds a chip and clears the text; pressing again removes it", async () => {
    const user = userEvent.setup();
    const changes = vi.fn();
    render(<Harness onChangeSpy={changes} />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "Person 002");
    await user.click(screen.getByRole("button", { name: /Person 002/ }));
    expect(changes).toHaveBeenLastCalledWith(["p2"]);
    expect(input).toHaveValue("");
    const row = screen.getByRole("button", {
      name: /Person 002/,
      pressed: true,
    });
    await user.click(row);
    expect(changes).toHaveBeenLastCalledWith([]);
  });

  test("the chips come in the order pressed and the chip button removes and focuses the input", async () => {
    const user = userEvent.setup();
    const changes = vi.fn();
    const { container } = render(<Harness onChangeSpy={changes} />);
    await user.click(screen.getByRole("button", { name: /Person 005/ }));
    await user.click(screen.getByRole("button", { name: /Person 003/ }));
    expect(changes).toHaveBeenLastCalledWith(["p5", "p3"]);
    const chips = container.querySelectorAll(".pchip .nm");
    expect(Array.from(chips).map((c) => c.textContent)).toEqual([
      "Person 005",
      "Person 003",
    ]);
    await user.click(screen.getByRole("button", { name: "Remove Person 005" }));
    expect(changes).toHaveBeenLastCalledWith(["p3"]);
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  test("focus stays on the row that was pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = screen.getByRole("button", { name: /Person 004/ });
    await user.click(row);
    expect(
      screen.getByRole("button", { name: /Person 004/, pressed: true }),
    ).toHaveFocus();
  });

  test("shows the first 50 matches", () => {
    render(<Harness />);
    expect(rowsOf()).toHaveLength(50);
  });

  test("a search with no match, and an empty list, show the empty text centred", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<Harness />);
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText("No people match")).toBeInTheDocument();
    expect(container.querySelector(".mlist.is-empty")).not.toBeNull();
    rerender(<Harness people={[]} />);
    expect(screen.getByText("No people match")).toBeInTheDocument();
  });

  test("the text is empty at each mount", () => {
    const { unmount } = render(<Harness />);
    unmount();
    render(<Harness />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  test("the eighth person is refused with the message under the field, until the next change", async () => {
    const user = userEvent.setup();
    const changes = vi.fn();
    render(
      <Harness
        max={7}
        selected={["p1", "p2", "p3", "p4", "p5", "p6", "p7"]}
        onChangeSpy={changes}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Person 008/ }));
    expect(changes).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Up to 8 people, counting you",
    );
    // A chosen row can still be removed, which changes `selected` and clears the message.
    await user.click(
      screen.getByRole("button", { name: /Person 001/, pressed: true }),
    );
    expect(changes).toHaveBeenLastCalledWith([
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("the message clears when the text changes", async () => {
    const user = userEvent.setup();
    render(<Harness max={1} selected={["p1"]} />);
    await user.click(screen.getByRole("button", { name: /Person 002/ }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "x");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a fieldset disabled around the picker disables the input, the rows and the chip buttons", () => {
    render(
      <fieldset disabled>
        <Harness selected={["p1"]} />
      </fieldset>,
    );
    expect(screen.getByRole("searchbox")).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  test("every row is a native button in the Tab order", () => {
    const { container } = render(<Harness selected={["p1"]} />);
    const list = container.querySelector(".mlist.people")!;
    for (const row of within(list as HTMLElement).getAllByRole("button")) {
      expect(row.tagName).toBe("BUTTON");
      expect(row).toHaveAttribute("type", "button");
      expect(row.tabIndex).toBe(0);
    }
  });

  test("120 people show 50, then 100, then 120 as the list is scrolled; a new text starts again at 50 (R19)", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const list = container.querySelector(".mlist.people") as HTMLElement;
    const nearEnd = () => {
      Object.defineProperty(list, "scrollTop", {
        value: 900,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(list, "clientHeight", {
        value: 300,
        configurable: true,
      });
      Object.defineProperty(list, "scrollHeight", {
        value: 1200,
        configurable: true,
      });
      fireEvent.scroll(list);
    };
    expect(rowsOf()).toHaveLength(50);
    nearEnd();
    expect(rowsOf()).toHaveLength(100);
    nearEnd();
    expect(rowsOf()).toHaveLength(120);
    await user.type(screen.getByRole("searchbox"), "Person");
    expect(rowsOf()).toHaveLength(50);
    expect(list.scrollTop).toBe(0);
  });
});
