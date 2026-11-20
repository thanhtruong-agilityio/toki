// @vitest-environment jsdom
import {
  act,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { conversations } from "../../../src/client";
import {
  personHue,
  useCurrentRole,
  useCurrentUserId,
  usePeople,
} from "../../../src/features/create-channel/deps";
import {
  PeoplePicker,
  type PeoplePickerProps,
} from "../../../src/features/create-channel/PeoplePickerStandIn";

afterEach(() => vi.restoreAllMocks());

describe("stand-in hooks over the store (TOKI-033, TOKI-034)", () => {
  test("no person loaded: no role, no id, no people", () => {
    expect(renderHook(() => useCurrentRole()).result.current).toBeNull();
    expect(renderHook(() => useCurrentUserId()).result.current).toBeNull();
    expect(renderHook(() => usePeople()).result.current).toEqual([]);
  });

  test("read the user and the people of the store", () => {
    vi.spyOn(conversations, "getUser").mockReturnValue({
      id: "u1",
      email: "a@b.c",
      displayName: "Lan",
      role: "admin",
      language: "en",
    });
    expect(renderHook(() => useCurrentRole()).result.current).toBe("admin");
    expect(renderHook(() => useCurrentUserId()).result.current).toBe("u1");
  });
});

describe("personHue", () => {
  test("is stable and between 0 and 359", () => {
    for (const id of ["a", "u1", "0190f2a1-0000-7000-8000-000000000000", "é"]) {
      const hue = personHue(id);
      expect(hue).toBe(personHue(id));
      expect(Number.isInteger(hue)).toBe(true);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

const people = [
  { id: "p1", displayName: "Lan Nguyễn", hue: 1 },
  { id: "p2", displayName: "Minh Tran", hue: 2 },
  { id: "p3", displayName: "Bao Le", hue: 3 },
];

function Harness(props: Partial<PeoplePickerProps> & { disabled?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <fieldset disabled={props.disabled}>
      <PeoplePicker
        people={people}
        selected={selected}
        onChange={setSelected}
        limitMessage="limit"
        searchLabel="Search"
        emptyText="nobody"
        removeLabel={(name) => `Remove ${name}`}
        {...props}
      />
    </fieldset>
  );
}

describe("stand-in PeoplePicker (R18 of TOKI-034)", () => {
  test("lists the candidates and the search ignores case and accents", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(3);
    await user.type(
      screen.getByRole("searchbox", { name: "Search" }),
      "nguyen",
    );
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("nobody")).toBeInTheDocument();
  });

  test("adds in the order pressed, removes by the chip and by the row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Spy() {
      const [selected, setSelected] = useState<string[]>([]);
      return (
        <PeoplePicker
          people={people}
          selected={selected}
          onChange={(ids) => {
            onChange(ids);
            setSelected(ids);
          }}
          limitMessage="limit"
          searchLabel="Search"
          emptyText="nobody"
          removeLabel={(n) => `Remove ${n}`}
        />
      );
    }
    render(<Spy />);
    await user.click(screen.getByRole("button", { name: /Minh/ }));
    await user.click(screen.getByRole("button", { name: /Lan/ }));
    expect(onChange).toHaveBeenLastCalledWith(["p2", "p1"]);
    await user.click(screen.getByRole("button", { name: "Remove Minh Tran" }));
    expect(onChange).toHaveBeenLastCalledWith(["p1"]);
    await user.click(
      screen.getByRole("button", { name: /Lan/, pressed: true }),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test("past max shows the limit message and adds nobody", async () => {
    const user = userEvent.setup();
    render(<Harness max={1} />);
    await user.click(screen.getByRole("button", { name: /Lan/ }));
    await user.click(screen.getByRole("button", { name: /Minh/ }));
    expect(screen.getByRole("status")).toHaveTextContent("limit");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  test("a disabled fieldset disables the input, every row and every remove button", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Lan/ }));
    rerender(<Harness disabled />);
    expect(screen.getByRole("searchbox")).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(
      within(document.body).getByRole("button", { name: "Remove Lan Nguyễn" }),
    ).toBeDisabled();
    await act(async () => {});
  });
});
