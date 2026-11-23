// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  MembershipControls,
  type MembershipControlsProps,
} from "../../../src/conversation/membership/MembershipControls";
import { NoAccessProvider } from "../../../src/conversation/membership/noAccess";
import { Providers } from "../../support/providers";
import { fake, resetFake } from "./fakeDeps";

vi.mock("../../../src/conversation/membership/deps", async () =>
  (await import("./fakeDeps")).fakeDepsModule(),
);

type Row = { id: string; displayName: string };

const h = {
  serverRows: [] as Row[],
  reload: vi.fn(),
  clearSearch: vi.fn(),
  status: "ready" as "ready" | "loading" | "failed",
  gate: null as null | Promise<void>,
  order: [] as string[],
};

beforeEach(() => {
  resetFake();
  h.serverRows = [
    { id: "p1", displayName: "Lan" },
    { id: "p2", displayName: "Minh" },
    { id: "me", displayName: "Me Myself" },
  ];
  h.reload.mockReset();
  h.clearSearch.mockReset();
  h.status = "ready";
  h.gate = null;
  h.order = [];
});

// A stand-in for `PeopleSection` that implements the slots of R16.
function FakeSection() {
  const [rows, setRows] = useState<Row[]>([...h.serverRows]);
  const reload = async () => {
    h.order.push("reload:start");
    h.reload();
    if (h.gate) await h.gate;
    setRows([...h.serverRows]);
    h.order.push("reload:end");
  };
  const props: Omit<MembershipControlsProps, "children"> = {
    conversationId: "c1",
    members: {
      ids: rows.map((r) => r.id),
      status: h.status,
      reload,
      clearSearch: h.clearSearch,
    },
  };
  return (
    <MembershipControls {...props}>
      {(slots) => (
        <section>
          <h3>Members</h3>
          {slots.heading}
          <div data-testid="list">
            {rows.map((p) => (
              <div className="mrow" key={p.id}>
                <div className="mrow-main">{p.displayName}</div>
                {slots.row(p as never)}
              </div>
            ))}
          </div>
          {slots.dialogs}
        </section>
      )}
    </MembershipControls>
  );
}

function setup() {
  const user = userEvent.setup();
  render(
    <Providers>
      <NoAccessProvider onNoAccess={() => {}}>
        <FakeSection />
      </NoAccessProvider>
    </Providers>,
  );
  return { user };
}

const removeButtons = () =>
  screen.queryAllByRole("button", { name: /^Remove .* from this channel$/ });
const addButton = () => screen.queryByRole("button", { name: "Add people" });

describe("who sees what (R4, R5)", () => {
  test("an Admin in a channel: Add people, and Remove on every row but their own", () => {
    setup();
    expect(addButton()).toBeTruthy();
    expect(removeButtons().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Remove Lan from this channel",
      "Remove Minh from this channel",
    ]);
  });

  test("a deactivated member's row also has Remove", () => {
    h.serverRows = [{ id: "d1", displayName: "Gone" }];
    fake.people = [{ id: "d1", displayName: "Gone", status: "deactivated" }];
    setup();
    expect(removeButtons()).toHaveLength(1);
  });

  test("the Remove button is the last child of .mrow and not inside another button or link", () => {
    setup();
    for (const row of document.querySelectorAll(".mrow")) {
      const button = row.querySelector(".mbr-remove");
      if (!button) continue;
      expect(row.lastElementChild).toBe(button);
      expect(button.parentElement).toBe(row);
      expect(button.closest("button:not(.mbr-remove), a")).toBeNull();
    }
  });

  test("a Member: Add people, no Remove anywhere", () => {
    fake.role = "member";
    setup();
    expect(addButton()).toBeTruthy();
    expect(removeButtons()).toHaveLength(0);
    expect(document.querySelector(".mbr-remove")).toBeNull();
  });

  test("an Admin in #general: Add people, no Remove", () => {
    fake.entry = { kind: "channel", isPrivate: false, isGeneral: true };
    setup();
    expect(addButton()).toBeTruthy();
    expect(removeButtons()).toHaveLength(0);
  });

  test("a private channel offers both", () => {
    fake.entry = { kind: "channel", isPrivate: true, isGeneral: false };
    setup();
    expect(addButton()).toBeTruthy();
    expect(removeButtons().length).toBeGreaterThan(0);
  });

  test.each([
    ["a direct message", { kind: "dm" }, { archived: false }],
    ["a group", { kind: "group_dm" }, { archived: false }],
    [
      "an archived channel",
      { kind: "channel", isPrivate: false, isGeneral: false },
      { archived: true },
    ],
    [
      "a held detail that is missing",
      { kind: "channel", isPrivate: false, isGeneral: false },
      undefined,
    ],
  ])("%s gets neither control", (_name, entry, detail) => {
    fake.entry = entry;
    fake.detail = detail;
    setup();
    expect(addButton()).toBeNull();
    expect(removeButtons()).toHaveLength(0);
  });

  test("Add people is disabled until the first read of the members has answered", () => {
    h.status = "loading";
    setup();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
  });
});

async function removeFirst(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    screen.getByRole("button", { name: `Remove ${name} from this channel` }),
  );
  const dlg = await screen.findByRole("dialog", {
    name: "Remove this person?",
  });
  await user.click(within(dlg).getByRole("button", { name: "Remove" }));
}

describe("after a change (R14)", () => {
  test("a removal reloads the list and the count, the row is gone, focus is on Add people", async () => {
    const { user } = setup();
    h.serverRows = h.serverRows.filter((r) => r.id !== "p1");
    await removeFirst(user, "Lan");
    await waitFor(() => expect(screen.queryByText("Lan")).toBeNull());
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(fake.readChannel).toHaveBeenCalledWith("c1");
    await waitFor(() => expect(document.activeElement).toBe(addButton()));
  });

  test("Add people is never disabled during the reload", async () => {
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    const { user } = setup();
    await removeFirst(user, "Lan");
    await waitFor(() => expect(h.order).toContain("reload:start"));
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
    await act(async () => release());
  });

  test("an add clears the members search first, shows the new person and closes the dialog", async () => {
    const { user } = setup();
    h.serverRows = [...h.serverRows, { id: "p3", displayName: "Newbie" }];
    fake.people = [
      ...fake.people,
      { id: "p3", displayName: "Newbie", status: "active" },
    ];
    await user.click(addButton() as HTMLElement);
    const dlg = await screen.findByRole("dialog", {
      name: /Add people to #design/,
    });
    await user.click(within(dlg).getByRole("button", { name: "Newbie" }));
    await user.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByText("Newbie")).toBeTruthy());
    expect(h.clearSearch).toHaveBeenCalledTimes(1);
    expect(h.clearSearch.mock.invocationCallOrder[0]!).toBeLessThan(
      h.reload.mock.invocationCallOrder[0]!,
    );
    expect(screen.queryByRole("dialog", { name: /Add people/ })).toBeNull();
  });

  test("two removals in a row get two reads, the second starting after the first has ended", async () => {
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    const { user } = setup();
    h.serverRows = h.serverRows.filter((r) => r.id !== "p1");
    await removeFirst(user, "Lan");
    await waitFor(() => expect(h.order).toEqual(["reload:start"]));
    h.serverRows = h.serverRows.filter((r) => r.id !== "p2");
    await removeFirst(user, "Minh");
    // The second read has not started while the first one runs.
    expect(h.order).toEqual(["reload:start"]);
    h.gate = null;
    await act(async () => release());
    await waitFor(() =>
      expect(h.order).toEqual([
        "reload:start",
        "reload:end",
        "reload:start",
        "reload:end",
      ]),
    );
    await waitFor(() => expect(screen.queryByText("Minh")).toBeNull());
  });
});
