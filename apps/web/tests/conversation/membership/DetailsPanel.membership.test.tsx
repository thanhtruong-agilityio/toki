// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DetailsPanel } from "../../../src/conversation/DetailsPanel";
import {
  crowd,
  detail,
  useFakeApi,
  type FakeApiHarness,
} from "../../support/conversation-api";
import { mountConversation } from "../../support/conversation-mount";
import {
  channel,
  dm,
  person,
  workspaceBody,
} from "../../support/conversation-store";

vi.mock("../../../src/client", async () =>
  (await import("../../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;
const onNoAccess = vi.fn();

async function setup(role: "admin" | "member", count = 3) {
  onNoAccess.mockReset();
  const { people, rows } = crowd(count);
  const body = workspaceBody(
    [
      channel("c1", "project-launch"),
      dm("d1", "p1"),
      { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
    ] as never,
    [
      ...people.map((p) => person(p.id, p.displayName)),
      person("p9", "Newbie Nine"),
    ],
  );
  body.user.role = role;
  h = useFakeApi(body, {
    details: [detail("c1", "project-launch", { memberCount: count })],
    members: { c1: rows },
  });
  // The two requests of TOKI-029: they change what the server returns next.
  const channels = h.api.channels as Record<string, unknown>;
  channels.removeMember = vi.fn(async (id: string, userId: string) => {
    h.memberRows[id] = h.memberRows[id]!.filter((r) => r.userId !== userId);
    const held = h.details[id]!;
    h.details[id] = { ...held, memberCount: held.memberCount - 1 } as never;
    return { changed: true };
  });
  channels.addMembers = vi.fn(async (id: string, ids: string[]) => {
    h.memberRows[id] = [
      ...h.memberRows[id]!,
      ...ids.map((userId) => ({ userId, joinedAt: "2026-01-01T00:00:00Z" })),
    ];
    const held = h.details[id]!;
    h.details[id] = {
      ...held,
      memberCount: held.memberCount + ids.length,
    } as never;
    return { added: ids, alreadyMembers: [] };
  });
  await h.loadNow();
}

const open = (id = "c1") =>
  mountConversation(
    (cid) => <DetailsPanel conversationId={cid} onNoAccess={onNoAccess} />,
    { path: `/c/${id}` },
  );

const heading = (name: string) =>
  screen.getByRole("heading", { level: 3, name });
const rowsOf = () => [...document.querySelectorAll(".mrow")];
const addButton = () => screen.queryByRole("button", { name: "Add people" });
const removeButtons = () =>
  screen.queryAllByRole("button", { name: /^Remove .* from this channel$/ });

beforeEach(() => onNoAccess.mockReset());

describe("the controls in the real panel (R5, R15, R16)", () => {
  test("an Admin sees Add people and a Remove on every member row", async () => {
    await setup("admin");
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    await waitFor(() =>
      expect((addButton() as HTMLButtonElement).disabled).toBe(false),
    );
    expect(removeButtons()).toHaveLength(3);
  });

  test("a Member sees Add people and no Remove", async () => {
    await setup("member");
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    expect(addButton()).toBeTruthy();
    expect(removeButtons()).toHaveLength(0);
  });

  test.each([
    ["a direct message", "d1"],
    ["a group", "g1"],
  ])("%s shows none of the new elements", async (_name, id) => {
    await setup("admin");
    await open(id);
    await screen.findAllByRole("heading", { level: 3 });
    expect(addButton()).toBeNull();
    expect(removeButtons()).toHaveLength(0);
    expect(document.querySelector(".mbr-add, .mbr-remove")).toBeNull();
  });

  test("an Admin removes a person: the row and the count follow, focus is on Add people", async () => {
    await setup("admin");
    const user = userEvent.setup();
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    expect(heading("Members · 3")).toBeTruthy();
    await user.click(
      screen.getByRole("button", {
        name: "Remove Member 002 from this channel",
      }),
    );
    const ask = await screen.findByRole("dialog", {
      name: "Remove this person?",
    });
    expect(ask.querySelector("p.cfm-target strong")?.textContent).toBe(
      "Member 002",
    );
    await user.click(within(ask).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(rowsOf()).toHaveLength(2));
    expect(screen.queryByText("Member 002")).toBeNull();
    await waitFor(() => expect(heading("Members · 2")).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(addButton()));
  });

  test("a person is added: the row and the count follow, and the dialog closes", async () => {
    await setup("member");
    const user = userEvent.setup();
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    await waitFor(() =>
      expect((addButton() as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(addButton() as HTMLElement);
    const dlg = await screen.findByRole("dialog", { name: "Add people to #project-launch" });
    // Members already in the channel are not offered.
    expect(within(dlg).queryByText("Member 001")).toBeNull();
    await user.click(within(dlg).getByRole("button", { name: "Newbie Nine" }));
    await user.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(rowsOf()).toHaveLength(4));
    await waitFor(() => expect(heading("Members · 4")).toBeTruthy());
    expect(
      screen.queryByRole("dialog", { name: "Add people to #project-launch" }),
    ).toBeNull();
    expect(
      (h.api.channels as Record<string, ReturnType<typeof vi.fn>>).addMembers,
    ).toHaveBeenCalledWith("c1", ["p9"]);
  });

  test("the other sections stay in the panel while a dialog is open", async () => {
    await setup("admin");
    const user = userEvent.setup();
    await open();
    await waitFor(() =>
      expect((addButton() as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(addButton() as HTMLElement);
    await screen.findByRole("dialog", { name: "Add people to #project-launch" });
    for (const name of ["Notifications", "Settings"]) {
      expect(
        screen.getAllByRole("heading", {
          level: 3,
          hidden: true,
          name: new RegExp(name),
        }).length,
      ).toBeGreaterThan(0);
    }
    await user.click(
      within(screen.getByRole("dialog", { name: "Add people to #project-launch" })).getByRole(
        "button",
        {
          name: "Cancel",
        },
      ),
    );
    expect(removeButtons()).toHaveLength(3);
  });
});
