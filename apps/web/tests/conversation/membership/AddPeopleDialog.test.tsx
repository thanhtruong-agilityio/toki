// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@toki/client-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AddPeopleDialog } from "../../../src/conversation/membership/AddPeopleDialog";
import { NoAccessProvider } from "../../../src/conversation/membership/noAccess";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { fake, makePeople, resetFake } from "./fakeDeps";

vi.mock("../../../src/conversation/membership/deps", async () =>
  (await import("./fakeDeps")).fakeDepsModule(),
);

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code } as never);

function Host({
  memberIds = [],
  onAdded,
  onClose,
  onNoAccess,
}: {
  memberIds?: string[];
  onAdded?: () => void;
  onClose?: () => void;
  onNoAccess?: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <NoAccessProvider onNoAccess={onNoAccess ?? (() => {})}>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <AddPeopleDialog
        open={open}
        conversationId="c1"
        memberIds={memberIds}
        onAdded={onAdded ?? (() => {})}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      />
    </NoAccessProvider>
  );
}

function setup(props: Parameters<typeof Host>[0] = {}) {
  const user = userEvent.setup();
  const view = render(
    <Providers>
      <Host {...props} />
    </Providers>,
  );
  return { user, ...view };
}

const dialog = () =>
  screen.getByRole("dialog", { name: /Add people to #design/ });
const rows = () =>
  within(dialog()).queryAllByRole("button", { pressed: false });
const pick = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(within(dialog()).getByRole("button", { name }));
const addButton = () => within(dialog()).getByRole("button", { name: "Add" });

describe("AddPeopleDialog (R7)", () => {
  test("is titled with the channel name and lists only candidates", () => {
    fake.people = [
      { id: "me", displayName: "Me Myself", status: "active" },
      { id: "m1", displayName: "Already Member", status: "active" },
      { id: "d1", displayName: "Gone Person", status: "deactivated" },
      { id: "a1", displayName: "Free Person", status: "active" },
    ];
    setup({ memberIds: ["m1"] });
    expect(within(dialog()).getByText("Free Person")).toBeTruthy();
    for (const hidden of ["Me Myself", "Already Member", "Gone Person"]) {
      expect(within(dialog()).queryByText(hidden)).toBeNull();
    }
  });

  test("120 candidates show 50, 100, then 120 as the list is scrolled", () => {
    fake.people = makePeople(120);
    const { container } = setup();
    const list = container.ownerDocument.querySelector(
      ".mlist.people",
    ) as HTMLElement;
    const near = () => {
      for (const [k, v] of [
        ["scrollTop", 900],
        ["clientHeight", 300],
        ["scrollHeight", 1200],
      ] as const) {
        Object.defineProperty(list, k, {
          value: v,
          configurable: true,
          writable: true,
        });
      }
      fireEvent.scroll(list);
    };
    const count = () => list.querySelectorAll("li").length;
    expect(count()).toBe(50);
    near();
    expect(count()).toBe(100);
    near();
    expect(count()).toBe(120);
  });

  test("gives the picker the candidates in order with a hue, the limit of 200 and its texts", () => {
    fake.people = [
      { id: "me", displayName: "Me Myself", status: "active" },
      { id: "b2", displayName: "Bao", status: "active" },
      { id: "a1", displayName: "Ann", status: "active" },
    ];
    setup();
    const props = fake.pickerProps as {
      people: { id: string; hue: number }[];
      max: number;
      limitMessage: string;
      searchLabel: string;
    };
    expect(props.people.map((p) => p.id)).toEqual(["b2", "a1"]);
    expect(props.people.every((p) => Number.isInteger(p.hue))).toBe(true);
    expect(props.max).toBe(200);
    expect(props.limitMessage).toBe("You can add up to 200 people at once.");
    expect(props.searchLabel).toBe("Search people");
  });

  test("everyone already a member shows the nobody text", () => {
    fake.people = makePeople(2);
    setup({ memberIds: ["p1", "p2", "me"] });
    expect(
      within(dialog()).getByText("Everyone is already in this channel."),
    ).toBeTruthy();
  });

  test("a search with no match shows the picker's own text, and matches without diacritics", async () => {
    fake.people = [{ id: "n1", displayName: "Nguyễn An", status: "active" }];
    const { user } = setup();
    const input = within(dialog()).getByRole("searchbox");
    await user.type(input, "nguyen");
    expect(within(dialog()).getByText("Nguyễn An")).toBeTruthy();
    await user.clear(input);
    await user.type(input, "zzz");
    expect(within(dialog()).getByText("No people match")).toBeTruthy();
  });

  test("the chosen people and the typed text are empty at each opening", async () => {
    const { user } = setup();
    await pick(user, "Person 001");
    await user.type(within(dialog()).getByRole("searchbox"), "xyz");
    // Esc with someone chosen asks; keep going: discard.
    await user.keyboard("{Escape}");
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /Add people/ })).toBeNull(),
    );
    await user.click(screen.getByRole("button", { name: "opener" }));
    expect(
      (within(dialog()).getByRole("searchbox") as HTMLInputElement).value,
    ).toBe("");
    expect(addButton().hasAttribute("disabled")).toBe(true);
    expect(rows().length).toBeGreaterThan(0);
  });
});

describe("AddPeopleDialog, Add (R8)", () => {
  test("Add is disabled until someone is chosen", async () => {
    const { user } = setup();
    expect(addButton().hasAttribute("disabled")).toBe(true);
    await pick(user, "Person 001");
    expect(addButton().hasAttribute("disabled")).toBe(false);
  });

  test("sends the ids in the order pressed, calls onAdded then onClose, shows no toast", async () => {
    const order: string[] = [];
    const { user } = setup({
      onAdded: () => order.push("added"),
      onClose: () => order.push("closed"),
    });
    await pick(user, "Person 003");
    await pick(user, "Person 001");
    await user.click(addButton());
    await waitFor(() => expect(order).toEqual(["added", "closed"]));
    expect(fake.addMembers).toHaveBeenCalledWith("c1", ["p3", "p1"]);
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a double press sends one request", async () => {
    let release: (v: unknown) => void = () => {};
    fake.addMembers.mockReturnValue(new Promise((r) => (release = r)));
    const { user } = setup();
    await pick(user, "Person 001");
    await user.dblClick(addButton());
    expect(fake.addMembers).toHaveBeenCalledTimes(1);
    await act(async () => release({ added: ["p1"], alreadyMembers: [] }));
  });

  test("offline sends nothing and keeps the chips and the dialog", async () => {
    setConnectionCheck(() => false);
    const onAdded = vi.fn();
    const { user } = setup({ onAdded });
    await pick(user, "Person 001");
    await user.click(addButton());
    expect(fake.addMembers).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
    expect(dialog()).toBeTruthy();
    expect(
      within(dialog()).getByRole("button", { name: "Remove Person 001" }),
    ).toBeTruthy();
  });
});

describe("AddPeopleDialog, errors (R9)", () => {
  test("invalid_member refreshes, drops the chip of the deactivated person and keeps the others", async () => {
    fake.addMembers.mockRejectedValue(http(400, "invalid_member"));
    fake.refresh.mockImplementation(async () => {
      fake.people = fake.people.map((p) =>
        p.id === "p1" ? { ...p, status: "deactivated" as const } : p,
      );
    });
    const { user } = setup();
    await pick(user, "Person 001");
    await pick(user, "Person 002");
    await user.click(addButton());
    expect((await within(dialog()).findByRole("alert")).textContent).toBe(
      "Some of these people can no longer be added.",
    );
    expect(fake.refresh).toHaveBeenCalled();
    expect(
      within(dialog()).queryByRole("button", { name: "Remove Person 001" }),
    ).toBeNull();
    expect(
      within(dialog()).getByRole("button", { name: "Remove Person 002" }),
    ).toBeTruthy();
    expect(addButton().hasAttribute("disabled")).toBe(false);
    // The dropped id is not sent again.
    fake.addMembers.mockResolvedValue({ added: ["p2"], alreadyMembers: [] });
    await user.click(addButton());
    await waitFor(() =>
      expect(fake.addMembers).toHaveBeenLastCalledWith("c1", ["p2"]),
    );
  });

  test("409 reads the channel again, closes and shows one toast", async () => {
    fake.addMembers.mockRejectedValue(http(409, "channel_archived"));
    const { user } = setup();
    await pick(user, "Person 001");
    await user.click(addButton());
    await waitFor(() => expect(fake.readChannel).toHaveBeenCalledWith("c1"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /Add people/ })).toBeNull(),
    );
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
  });

  test.each([403, 404])(
    "%i reaches the panel's no-access page",
    async (status) => {
      fake.addMembers.mockRejectedValue(http(status, "forbidden"));
      const onNoAccess = vi.fn();
      const { user } = setup({ onNoAccess });
      await pick(user, "Person 001");
      await user.click(addButton());
      await waitFor(() => expect(onNoAccess).toHaveBeenCalledTimes(1));
    },
  );

  test.each([
    ["500", http(500, "internal")],
    ["400 validation_failed", http(400, "validation_failed")],
    ["timeout", new ApiError({ kind: "timeout" })],
  ])("%s shows the line and keeps the chips", async (_n, error) => {
    fake.addMembers.mockRejectedValue(error);
    const { user } = setup();
    await pick(user, "Person 001");
    await user.click(addButton());
    expect((await within(dialog()).findByRole("alert")).textContent).toBe(
      "That did not work. Try again.",
    );
    expect(
      within(dialog()).getByRole("button", { name: "Remove Person 001" }),
    ).toBeTruthy();
    expect(addButton().hasAttribute("disabled")).toBe(false);
  });
});

describe("AddPeopleDialog, form guard (R10)", () => {
  test("with nobody chosen every close request closes at once", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("with two chosen the close button and Cancel ask, an outside press does nothing", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await pick(user, "Person 001");
    await pick(user, "Person 002");
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    const ask = await screen.findByRole("dialog", {
      name: "Discard what you typed?",
    });
    expect(within(ask).getByText("Add people to #design")).toBeTruthy();
    await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(dialog()).getByRole("button", { name: "Close" }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Discard what you typed?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test("with nobody chosen the Close button also closes at once", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await user.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("with two chosen an outside press does nothing and Esc asks", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await pick(user, "Person 001");
    await pick(user, "Person 002");
    const scrim = document.querySelector(".scrim") as HTMLElement;
    fireEvent.pointerDown(scrim);
    fireEvent.pointerUp(scrim);
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Discard what you typed?" }),
    ).toBeNull();
    await user.keyboard("{Escape}");
    expect(
      await screen.findByRole("dialog", { name: "Discard what you typed?" }),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a typed search alone does not make the form guarded", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await user.type(within(dialog()).getByRole("searchbox"), "abc");
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
