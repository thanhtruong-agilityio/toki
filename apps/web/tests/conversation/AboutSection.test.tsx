// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clock } from "../../src/clock";
import { DetailsPanel } from "../../src/conversation/DetailsPanel";
import {
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
import { ApiError } from "@toki/client-core";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

const NOW = Date.parse("2025-06-01T12:00:00Z");
let h: FakeApiHarness;
const onNoAccess = vi.fn();

beforeEach(async () => {
  onNoAccess.mockReset();
  vi.spyOn(clock, "now").mockReturnValue(NOW);
  h = useFakeApi(
    workspaceBody(
      [
        channel("c1", "project-launch", { topic: "Ship it" }),
        channel("c2", "leadership", { isPrivate: true }),
        dm("d1", "p1"),
        { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
      ] as never,
      [
        person("p1", "Alex Phạm"),
        person("p2", "Thu Hoàng"),
        person("lan", "Lan"),
        person("gone", "Old Lan", "deactivated"),
      ],
    ),
    {
      details: [
        detail("c1", "project-launch", {
          topic: "Ship it",
          description: "Plan the launch",
          createdBy: "lan",
          createdAt: "2025-01-08T10:00:00.000Z",
        }),
        detail("c2", "leadership", {
          isPrivate: true,
          topic: null,
          description: null,
          createdBy: "lan",
          createdAt: "2025-01-08T10:00:00.000Z",
        }),
      ],
    },
  );
  await h.loadNow();
});
afterEach(() => vi.restoreAllMocks());

const open = (id: string, language?: "en" | "vi") =>
  mountConversation(
    (cid) => <DetailsPanel conversationId={cid} onNoAccess={onNoAccess} />,
    { path: `/c/${id}`, language },
  );

const about = () =>
  screen.getByRole("heading", { level: 3, name: /^(About|Giới thiệu)$/ })
    .parentElement as HTMLElement;

describe("About for a channel (R12)", () => {
  test("shows the name, topic, description and 'Created by Lan · 8 Jan'", async () => {
    await open("c1");
    const section = about();
    expect(section.querySelector(".dp-name")).toHaveTextContent(
      "project-launch",
    );
    expect(section.querySelector(".dp-topic")).toHaveTextContent("Ship it");
    expect(within(section).getByText("Plan the launch").className).toContain(
      "muted",
    );
    expect(
      within(section).getByText("Created by Lan · 8 Jan"),
    ).toBeInTheDocument();
  });

  test("a private channel draws the lock, a public one the hash", async () => {
    await open("c2");
    expect(
      about().querySelector(".dp-name svg path")?.getAttribute("d"),
    ).toMatch(/^M5 11h14/);
  });

  test("a date from another year carries the year", async () => {
    h.details.c1 = detail("c1", "project-launch", {
      topic: "Ship it",
      createdBy: "lan",
      createdAt: "2024-01-08T10:00:00.000Z",
    });
    await open("c1");
    expect(
      within(about()).getByText("Created by Lan · 8 Jan 2024"),
    ).toBeInTheDocument();
  });

  test("a creator the store does not hold is left out and the date stands alone", async () => {
    h.details.c1 = { ...h.details.c1, createdBy: "unknown" } as never;
    await open("c1");
    expect(within(about()).getByText("Created 8 Jan")).toBeInTheDocument();
  });

  test("a deactivated creator is named", async () => {
    h.details.c1 = { ...h.details.c1, createdBy: "gone" } as never;
    await open("c1");
    expect(
      within(about()).getByText("Created by Old Lan · 8 Jan"),
    ).toBeInTheDocument();
  });

  test.each([["not a date"], [""]])(
    "an unreadable createdAt (%j) draws no date",
    async (bad) => {
      h.details.c1 = { ...h.details.c1, createdAt: bad } as never;
      await open("c1");
      expect(within(about()).getByText("Created by Lan")).toBeInTheDocument();
      expect(about()).not.toHaveTextContent("Jan");
    },
  );

  test("a null creator and no date draw no created line", async () => {
    h.details.c1 = {
      ...h.details.c1,
      createdBy: "unknown",
      createdAt: "x",
    } as never;
    await open("c1");
    expect(about().querySelector(".xs")).toBeNull();
  });

  test("a null topic and a null description show the muted lines", async () => {
    await open("c2");
    const section = about();
    expect(within(section).getByText("No topic yet").className).toContain(
      "muted",
    );
    expect(within(section).getByText("No description yet").className).toContain(
      "muted",
    );
  });

  test("the date follows the browser's zone: near midnight it moves a day", async () => {
    h.details.c1 = {
      ...h.details.c1,
      createdAt: "2025-01-08T18:30:00.000Z",
    } as never;
    const zone = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions");
    zone.mockReturnValue({ timeZone: "Asia/Ho_Chi_Minh" } as never);
    await open("c1");
    expect(
      within(about()).getByText("Created by Lan · 9 Jan"),
    ).toBeInTheDocument();
    document.body.innerHTML = "";
    zone.mockReturnValue({ timeZone: "America/New_York" } as never);
    await open("c1");
    expect(
      within(about()).getByText("Created by Lan · 8 Jan"),
    ).toBeInTheDocument();
  });

  test("in Vietnamese the labels are Vietnamese and the date keeps the English month (concern 6)", async () => {
    await open("c1", "vi");
    expect(
      screen.getByRole("heading", { level: 3, name: "Giới thiệu" }),
    ).toBeInTheDocument();
    expect(
      within(about()).getByText("Tạo bởi Lan · 8 Jan"),
    ).toBeInTheDocument();
  });
});

describe("About for a DM and a group (R12)", () => {
  test.each([
    ["d1", "Alex Phạm"],
    ["g1", "Alex Phạm, Thu Hoàng"],
  ])(
    "%s shows the name and 'Direct conversation' and nothing else",
    async (id, name) => {
      await open(id);
      const section = about();
      expect(section.querySelector(".dp-name")).toHaveTextContent(name);
      expect(
        within(section).getByText("Direct conversation"),
      ).toBeInTheDocument();
      expect(section.querySelector(".xs")).toBeNull();
      expect(within(section).queryByText("No topic yet")).toBeNull();
      expect(h.api.channels.get).not.toHaveBeenCalled();
    },
  );
});

describe("loading and failure of the read (R14)", () => {
  test("while the detail is not held About shows the entry's name and topic and no description, creator or date", async () => {
    let release!: () => void;
    h.api.channels.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details.c1 });
        }),
    );
    await open("c1");
    const section = about();
    expect(section.querySelector(".dp-name")).toHaveTextContent(
      "project-launch",
    );
    expect(section.querySelector(".dp-topic")).toHaveTextContent("Ship it");
    expect(within(section).queryByText("No description yet")).toBeNull();
    expect(section.querySelector(".xs")).toBeNull();
    await act(async () => release());
    expect(within(about()).getByText("Plan the launch")).toBeInTheDocument();
  });

  test.each([
    ["409", http(409)],
    ["429", http(429)],
    ["500", http(500)],
    ["network", new ApiError({ kind: "network" })],
    ["timeout", new ApiError({ kind: "timeout" })],
  ])(
    "a %s shows the failure and a Retry that reads again once",
    async (_n, error) => {
      h.api.channels.get.mockRejectedValueOnce(error);
      await open("c1");
      // The header is not drawn here, so the panel's read is the only one.
      expect(h.api.channels.get).toHaveBeenCalledTimes(1);
      expect(
        within(about()).getByText("Could not load this."),
      ).toBeInTheDocument();
      await userEvent.click(
        within(about()).getByRole("button", { name: "Retry" }),
      );
      expect(h.api.channels.get).toHaveBeenCalledTimes(2);
      expect(within(about()).queryByText("Could not load this.")).toBeNull();
      expect(within(about()).getByText("Plan the launch")).toBeInTheDocument();
      expect(onNoAccess).not.toHaveBeenCalled();
    },
  );

  test("an unreadable answer shows the failure and no Retry", async () => {
    h.api.channels.get.mockRejectedValueOnce(
      new ApiError({ kind: "invalid_response" }),
    );
    await open("c1");
    expect(
      within(about()).getByText("Could not load this."),
    ).toBeInTheDocument();
    expect(within(about()).queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test.each([
    ["403", http(403)],
    ["404", http(404)],
  ])("a %s calls onNoAccess and shows no failure text", async (_n, error) => {
    h.api.channels.get.mockRejectedValueOnce(error);
    await open("c1");
    expect(onNoAccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Could not load this.")).toBeNull();
  });

  test("an aborted read and a session 401 show nothing and do nothing", async () => {
    h.api.channels.get.mockRejectedValueOnce(new ApiError({ kind: "aborted" }));
    await open("c1");
    expect(screen.queryByText("Could not load this.")).toBeNull();
    expect(onNoAccess).not.toHaveBeenCalled();
  });

  test("when the detail is already held a failed read keeps what is shown", async () => {
    await act(async () => void (await h.store.readChannel("c1")));
    h.api.channels.get.mockRejectedValueOnce(http(500));
    await open("c1");
    expect(within(about()).getByText("Plan the launch")).toBeInTheDocument();
    expect(screen.queryByText("Could not load this.")).toBeNull();
  });
});
