// @vitest-environment jsdom
import { ApiError } from "@toki/client-core";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DetailsPanel } from "../../src/conversation/DetailsPanel";
import type { PeopleControls } from "../../src/conversation/PeopleSection";
import {
  crowd,
  detail,
  http,
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
const onNoAccess = vi.fn();

async function setup(count: number, over: { deactivated?: string[] } = {}) {
  onNoAccess.mockReset();
  const { people, rows } = crowd(count);
  h = useFakeApi(
    workspaceBody(
      [
        channel("c1", "project-launch"),
        dm("d1", "p1"),
        { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
      ] as never,
      people.map((p) =>
        person(
          p.id,
          p.displayName,
          over.deactivated?.includes(p.id) ? "deactivated" : "active",
        ),
      ),
    ),
    {
      details: [detail("c1", "project-launch", { memberCount: count })],
      members: { c1: rows },
    },
  );
  await h.loadNow();
}

const open = (id = "c1", Controls?: PeopleControls) =>
  mountConversation(
    (cid) => (
      <DetailsPanel
        conversationId={cid}
        onNoAccess={onNoAccess}
        Controls={Controls}
      />
    ),
    { path: `/c/${id}` },
  );

const section = (name: RegExp | string = /^(Members|Person)/) =>
  screen.getByRole("heading", { level: 3, name }).parentElement as HTMLElement;
const rowsOf = () => [...document.querySelectorAll(".mrow")] as HTMLElement[];
const names = () =>
  rowsOf().map((r) => r.querySelector(".mrow-main b")?.textContent);

// jsdom has no layout: the panel's scroll box is given a size and a position.
function scrollTo(position: { top: number; height: number; client: number }) {
  const box = document.querySelector(".sb") as HTMLElement;
  Object.defineProperty(box, "scrollHeight", {
    configurable: true,
    value: position.height,
  });
  Object.defineProperty(box, "clientHeight", {
    configurable: true,
    value: position.client,
  });
  Object.defineProperty(box, "scrollTop", {
    configurable: true,
    value: position.top,
  });
  fireEvent.scroll(box);
}

describe("a channel (R13)", () => {
  test("3 members: the heading with the count, rows sorted by name, no search field", async () => {
    await setup(3);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    expect(
      screen.getByRole("heading", { level: 3, name: "Members · 3" }),
    ).toBeInTheDocument();
    expect(names()).toEqual(["Member 001", "Member 002", "Member 003"]);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(
      screen.queryByRole("textbox", { name: "Search members" }),
    ).toBeNull();
  });

  test("the markup of a row: div.mrow, div.mrow-main first with the avatar and the bold name", async () => {
    await setup(3);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    const row = rowsOf()[0];
    expect(row.tagName).toBe("DIV");
    expect(row.children).toHaveLength(1);
    const main = row.children[0] as HTMLElement;
    expect(main.className).toBe("mrow-main");
    expect(main.querySelector("span.av")?.getAttribute("style")).toContain(
      "--s: 32px",
    );
    expect(main.querySelector("b")).toHaveTextContent("Member 001");
    expect(row.querySelector("button")).toBeNull();
  });

  test("a deactivated member carries the Deactivated tag", async () => {
    await setup(3, { deactivated: ["p2"] });
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    expect(within(rowsOf()[1]).getByText("Deactivated").className).toContain(
      "tag",
    );
    expect(within(rowsOf()[0]).queryByText("Deactivated")).toBeNull();
  });

  test("120 members: 50 rows, then 100, then 120 after two scrolls; 2 requests of 100", async () => {
    await setup(120);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    expect(h.api.channels.members).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("heading", { level: 3, name: "Members · 120" }),
    ).toBeInTheDocument();
    // Far from the end: nothing more.
    act(() => scrollTo({ top: 0, height: 5000, client: 500 }));
    expect(rowsOf()).toHaveLength(50);
    act(() => scrollTo({ top: 4450, height: 5000, client: 500 }));
    expect(rowsOf()).toHaveLength(100);
    act(() => scrollTo({ top: 4450, height: 5000, client: 500 }));
    expect(rowsOf()).toHaveLength(120);
  });

  test("200 members take 2 requests and 201 take 3", async () => {
    await setup(200);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    expect(h.api.channels.members).toHaveBeenCalledTimes(2);
  });

  test("the search field is absent at 50 and present at 51; it filters by name, ignoring case", async () => {
    await setup(50);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    expect(
      screen.queryByRole("searchbox", { name: "Search members" }),
    ).toBeNull();
    document.body.innerHTML = "";
    await setup(51);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    const field = screen.getByRole("searchbox", { name: "Search members" });
    await userEvent.type(field, "mEmBeR 051");
    expect(names()).toEqual(["Member 051"]);
  });

  test("a filter that matches nothing shows 'No members match' in the section", async () => {
    await setup(60);
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search members" }),
      "zzz",
    );
    expect(rowsOf()).toHaveLength(0);
    const none = within(section()).getByText("No members match");
    expect(none.className).toContain("dp-empty");
  });

  test("while the first read runs the section says it is loading", async () => {
    await setup(3);
    let release: () => void = () => {};
    const original = h.api.channels.members.getMockImplementation() as (
      id: string,
      q: object,
    ) => Promise<unknown>;
    h.api.channels.members.mockImplementation(async (id: string, q: object) => {
      await new Promise<void>((r) => void (release = r));
      return original(id, q);
    });
    await open();
    expect(within(section()).getByText("Loading members…")).toBeInTheDocument();
    await act(async () => release());
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
  });

  test("an id in the list that the store does not hold leaves no row and no error", async () => {
    await setup(3);
    h.memberRows.c1 = [...h.memberRows.c1, { userId: "ghost", joinedAt: "x" }];
    await open();
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    expect(screen.queryByText("Could not load this.")).toBeNull();
  });
});

describe("failure (R14)", () => {
  test.each([
    ["500", http(500)],
    ["network", new ApiError({ kind: "network" })],
    ["timeout", new ApiError({ kind: "timeout" })],
    ["429", http(429)],
    ["409", http(409)],
  ])(
    "a first read that fails with %s shows the text and a Retry that reads again",
    async (_n, error) => {
      await setup(3);
      h.api.channels.members.mockRejectedValueOnce(error);
      await open();
      await waitFor(() =>
        expect(
          within(section()).getByText("Could not load this."),
        ).toBeInTheDocument(),
      );
      await userEvent.click(
        within(section()).getByRole("button", { name: "Retry" }),
      );
      await waitFor(() => expect(rowsOf()).toHaveLength(3));
      expect(h.api.channels.members).toHaveBeenCalledTimes(2);
    },
  );

  test("an unreadable answer shows the text and no Retry", async () => {
    await setup(3);
    h.api.channels.members.mockRejectedValueOnce(
      new ApiError({ kind: "invalid_response" }),
    );
    await open();
    await waitFor(() =>
      expect(
        within(section()).getByText("Could not load this."),
      ).toBeInTheDocument(),
    );
    expect(
      within(section()).queryByRole("button", { name: "Retry" }),
    ).toBeNull();
  });

  test("403 and 404 go to onNoAccess", async () => {
    await setup(3);
    h.api.channels.members.mockRejectedValueOnce(http(403));
    await open();
    await waitFor(() => expect(onNoAccess).toHaveBeenCalledTimes(1));
  });

  test("the rest of the panel stays usable while the members read fails", async () => {
    await setup(3);
    h.api.channels.members.mockRejectedValue(http(500));
    await open();
    await waitFor(() =>
      expect(
        within(section()).getByText("Could not load this."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "About" }),
    ).toBeInTheDocument();
  });
});

describe("a group and a DM", () => {
  test("a group draws rows from memberIds with no request and no search field", async () => {
    await setup(60);
    await open("g1");
    expect(rowsOf().map((r) => r.querySelector("b")?.textContent)).toEqual([
      "Me",
      "Member 001",
      "Member 002",
    ]);
    expect(h.api.channels.members).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 3, name: "Members · 3" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("a DM has the heading Person and the one row of the other person", async () => {
    await setup(3);
    await open("d1");
    expect(
      screen.getByRole("heading", { level: 3, name: "Person" }),
    ).toBeInTheDocument();
    expect(names()).toEqual(["Member 001"]);
    expect(h.api.channels.members).not.toHaveBeenCalled();
  });
});

describe("the Controls seam (R13)", () => {
  const Controls: PeopleControls = ({ conversationId, members, children }) => (
    <>
      <p data-testid="probe">
        {conversationId}|{members.ids.length}|{members.status}|
        {typeof members.reload}
      </p>
      <button onClick={members.clearSearch}>clear</button>
      {children({
        heading: <p data-testid="slot-heading">heading</p>,
        row: (p) => <i data-testid="slot-row">{p.id}</i>,
        dialogs: <p data-testid="slot-dialogs">dialogs</p>,
      })}
    </>
  );

  test("draws a marker in each slot, in the places the spec names, and passes ids, status and reload", async () => {
    await setup(60);
    await open("c1", Controls);
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    const probe = screen.getByTestId("probe");
    expect(probe).toHaveTextContent("c1|60|ready|function");
    const h3 = screen.getByRole("heading", { level: 3, name: /^Members/ });
    // heading: directly under the h3 and above the search field
    expect(h3.nextElementSibling).toBe(screen.getByTestId("slot-heading"));
    expect(screen.getByTestId("slot-heading").nextElementSibling).toBe(
      screen
        .getByRole("searchbox", { name: "Search members" })
        .closest("label"),
    );
    // row: the last child of each .mrow
    for (const row of rowsOf())
      expect(row.lastElementChild).toBe(within(row).getByTestId("slot-row"));
    expect(rowsOf()[0].children[0].className).toBe("mrow-main");
    // dialogs: once after the list
    expect(screen.getAllByTestId("slot-dialogs")).toHaveLength(1);
    expect(rowsOf().at(-1)!.closest("section")!.lastElementChild).toBe(
      screen.getByTestId("slot-dialogs"),
    );
  });

  test("clearSearch empties the search field", async () => {
    await setup(60);
    await open("c1", Controls);
    await waitFor(() => expect(rowsOf()).toHaveLength(50));
    const field = screen.getByRole("searchbox", { name: "Search members" });
    await userEvent.type(field, "zzz");
    expect(rowsOf()).toHaveLength(0);
    await userEvent.click(screen.getByText("clear"));
    expect(field).toHaveValue("");
    expect(rowsOf()).toHaveLength(50);
  });

  test("without Controls a group and a DM draw no slot and a channel draws none either", async () => {
    await setup(3);
    await open("c1");
    await waitFor(() => expect(rowsOf()).toHaveLength(3));
    expect(screen.queryByTestId("slot-row")).toBeNull();
  });

  test("a DM and a group ignore Controls", async () => {
    await setup(3);
    await open("d1", Controls);
    expect(screen.queryByTestId("probe")).toBeNull();
  });
});
