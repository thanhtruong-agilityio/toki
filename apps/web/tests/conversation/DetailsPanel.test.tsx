// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DetailsPanel } from "../../src/conversation/DetailsPanel";
import {
  crowd,
  detail,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { mountConversation } from "../support/conversation-mount";
import {
  channel,
  dm,
  person,
  workspaceBody,
} from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;

beforeEach(async () => {
  const { people, rows } = crowd(3);
  h = useFakeApi(
    workspaceBody(
      [
        channel("c1", "project-launch"),
        channel("c2", "leadership", { isPrivate: true }),
        channel("gen", "general", { isGeneral: true }),
        dm("d1", "p1"),
        { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
      ] as never,
      people.map((p) => person(p.id, p.displayName)),
    ),
    {
      details: [
        detail("c1", "project-launch", { createdBy: "p1" }),
        detail("c2", "leadership", { isPrivate: true, createdBy: "p1" }),
        detail("gen", "general", { isGeneral: true, createdBy: "p1" }),
        detail("a1", "old-project", {
          archived: true,
          createdBy: "p1",
          memberCount: 3,
        }),
      ],
      members: { c1: rows, c2: rows, gen: rows, a1: rows },
    },
  );
  await h.loadNow();
});

const open = (id: string) =>
  mountConversation(
    (cid) => <DetailsPanel conversationId={cid} onNoAccess={() => {}} />,
    {
      path: `/c/${id}?panel=details`,
    },
  );

const headings = () =>
  screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
const title = () => screen.getByRole("heading", { level: 2 }).textContent;
const body = () =>
  document.getElementById("conversation-details") as HTMLElement;

describe("the frame (R11)", () => {
  test.each([
    ["c1", "Details", ["About", "Members · 3", "Notifications", "Settings"]],
    ["c2", "Details", ["About", "Members · 3", "Notifications", "Settings"]],
    ["gen", "Details", ["About", "Members · 3", "Notifications", "Settings"]],
    ["g1", "Details", ["About", "Members · 3", "Notifications", "Settings"]],
    ["d1", "Profile", ["About", "Person", "Notifications", "Settings"]],
  ])(
    "%s: the title %s and the headings in order",
    async (id, expectedTitle, expected) => {
      await open(id);
      await waitFor(() => expect(headings()).toEqual(expected));
      expect(title()).toBe(expectedTitle);
    },
  );

  test("the sections sit in one div with the id the members button names", async () => {
    await open("c1");
    expect(body().parentElement?.className).toBe("sb");
    expect(
      body().querySelectorAll(":scope > section").length,
    ).toBeGreaterThanOrEqual(4);
  });

  test("the Leave button is the last element of the body and has no heading of its own", async () => {
    await open("c1");
    const last = body().lastElementChild as HTMLElement;
    expect(last.className).toBe("dp-leave");
    expect(
      within(last).getByRole("button", { name: "Leave channel" }),
    ).toBeInTheDocument();
    expect(last.querySelector("h3")).toBeNull();
  });

  test("no Guests, Email or Automations section", async () => {
    await open("c1");
    expect(body()).not.toHaveTextContent(/guests|email this|automations/i);
  });

  test("the labels of the buttons come from common (Back, Close panel)", async () => {
    await open("c1");
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close panel" }),
    ).toBeInTheDocument();
  });
});

describe("an archived channel (R30)", () => {
  test("draws About, Members and Leave only, with the count and the list from the channel read", async () => {
    await open("a1");
    await waitFor(() => expect(headings()).toEqual(["About", "Members · 3"]));
    expect(title()).toBe("Details");
    expect(document.querySelectorAll(".mrow")).toHaveLength(3);
    expect(body().querySelector(".dp-name")).toHaveTextContent("old-project");
    expect(screen.getByRole("button", { name: "Leave channel" })).toBeEnabled();
    expect(body().lastElementChild?.className).toBe("dp-leave");
  });

  test("no Edit button, no radio and no switch is in the document", async () => {
    await open("a1");
    await waitFor(() => expect(headings()).toContain("About"));
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });
});
