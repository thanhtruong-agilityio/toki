// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  channel,
  dm,
  ME,
  person,
  useFakeStore,
  workspaceBody,
  type StoreHarness,
} from "../support/conversation-store";
import { fakeDevice, mountPane } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

const people = [
  person("p1", "Alex Phạm"),
  person("p2", "Thu Hoàng"),
  person("p3", "Dee", "deactivated"),
];
const world = () =>
  workspaceBody(
    [
      channel("gen", "general", { isGeneral: true }),
      channel("zeta", "zeta"),
      channel("star", "launch", { isStarred: true }),
      channel("sec", "secret", { isPrivate: true }),
      dm("d1", "p1"),
      dm("d3", "p3"),
      {
        ...dm("g1", "p1"),
        kind: "group_dm",
        memberIds: [ME, "p1", "p2"],
      } as never,
    ],
    people,
  );

const group = (id: string) =>
  document.querySelector<HTMLElement>(`.cgroup[data-group="${id}"]`);
const rowNames = (id: string) =>
  [...(group(id)?.querySelectorAll(".cr .nm") ?? [])].map((n) => n.textContent);
const heading = (id: string) =>
  group(id)!.querySelector<HTMLButtonElement>("button.sec")!;
const count = (id: string) =>
  group(id)?.querySelector(".sec-count [aria-hidden]")?.textContent ?? null;

let h: StoreHarness;
let device: ReturnType<typeof fakeDevice>;
beforeEach(async () => {
  device = fakeDevice();
  h = useFakeStore(world());
  await h.loadNow();
});

describe("the groups (R15, R16)", () => {
  test("draws the three groups in the order the store gives, each conversation once", async () => {
    await mountPane();
    const ids = [...document.querySelectorAll(".cgroup")].map(
      (g) => (g as HTMLElement).dataset.group,
    );
    expect(ids).toEqual(["starred", "channels", "direct"]);
    expect(rowNames("starred")).toEqual(["launch"]);
    expect(rowNames("channels")).toEqual(["general", "secret", "zeta"]);
    const all = [...document.querySelectorAll("a.cr")].map((a) =>
      a.getAttribute("href"),
    );
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(7);
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeTruthy();
  });

  test("a group direct message is named with the full names joined", async () => {
    await mountPane();
    expect(rowNames("direct")).toContain("Alex Phạm, Thu Hoàng");
  });

  test("a deactivated person's direct message carries the label, a private channel its sr text", async () => {
    await mountPane();
    const rows = [...group("direct")!.querySelectorAll("a.cr")];
    const dee = rows.find((r) => r.textContent?.includes("Dee"))!;
    expect(within(dee as HTMLElement).getByText("Deactivated")).toBeTruthy();
    const secret = [...group("channels")!.querySelectorAll("a.cr")].find((r) =>
      r.textContent?.includes("secret"),
    )!;
    expect(secret.textContent).toContain("Private channel");
    // a direct message is private in the store but is not a "private channel"
    const alex = rows.find((r) => r.textContent?.startsWith("Alex"))!;
    expect(alex.textContent).not.toContain("Private channel");
  });

  test("the starred row carries the star label and hrefs are /c/<id>", async () => {
    await mountPane();
    const row = group("starred")!.querySelector("a.cr")!;
    expect(row.getAttribute("href")).toBe("/c/star");
    expect(row.querySelector(".star")).not.toBeNull();
  });

  test("keepWhenEmpty: a store with no direct message keeps the heading with All and no search only", async () => {
    h = useFakeStore(
      workspaceBody([channel("gen", "general", { isGeneral: true })]),
    );
    await h.loadNow();
    await mountPane();
    expect(group("direct")).not.toBeNull();
    expect(group("starred")).toBeNull();
    expect(group("channels")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(group("direct")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(group("direct")).not.toBeNull();
    await userEvent.type(screen.getByRole("searchbox"), "x");
    expect(group("direct")).toBeNull();
  });
});

describe("the unread total of a collapsed group (R15, concern 18)", () => {
  const collapsedChannels = () =>
    fakeDevice({
      "conversationList.collapsed": JSON.stringify({
        userId: ME,
        value: ["channels"],
      }),
    });
  async function withCounts(
    counts: Array<[string, number, boolean?]>,
    collapsed = true,
  ) {
    if (collapsed) collapsedChannels();
    const channels = counts.map(([id, , muted]) =>
      channel(id, id, { isMuted: muted === true }),
    );
    h = useFakeStore(workspaceBody(channels));
    await h.loadNow();
    for (const [id, n] of counts)
      h.store.setUnread(id, { count: n, mention: false });
    return mountPane();
  }

  test("rows 2, 3 and 4, the 4 muted, give 5", async () => {
    await withCounts([
      ["a", 2],
      ["b", 3],
      ["c", 4, true],
    ]);
    expect(count("channels")).toBe("5");
    expect(
      group("channels")!.querySelector(".sec-count .sr"),
    ).toHaveTextContent("5 unread");
  });

  test("the same group expanded shows none", async () => {
    await withCounts(
      [
        ["a", 2],
        ["b", 3],
      ],
      false,
    );
    expect(count("channels")).toBeNull();
  });

  test("rows 0, -1, NaN and 3 give 3", async () => {
    await withCounts([
      ["a", 0],
      ["b", -1],
      ["c", NaN],
      ["d", 3],
    ]);
    expect(count("channels")).toBe("3");
  });

  test("rows 3, -1 and 2 give 5", async () => {
    await withCounts([
      ["a", 3],
      ["b", -1],
      ["c", 2],
    ]);
    expect(count("channels")).toBe("5");
  });

  test("only a muted unread row, or no count, draws none", async () => {
    await withCounts([["a", 4, true]]);
    expect(count("channels")).toBeNull();
  });

  test("the total follows a row being muted", async () => {
    await withCounts([
      ["a", 2],
      ["b", 3],
    ]);
    expect(count("channels")).toBe("5");
    const body = workspaceBody([
      channel("a", "a"),
      channel("b", "b", { isMuted: true }),
    ]);
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(count("channels")).toBe("2");
  });

  test("the total follows a change of the store at once", async () => {
    await withCounts([
      ["a", 2],
      ["b", 3],
    ]);
    expect(count("channels")).toBe("5");
    act(() => h.store.setUnread("a", { count: 0, mention: false }));
    expect(count("channels")).toBe("3");
  });
});

describe("a big store (R15)", () => {
  test("500 rows draw without error, each once", async () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      channel(`c${i}`, `channel-${String(i).padStart(3, "0")}`),
    );
    h = useFakeStore(workspaceBody(many));
    await h.loadNow();
    await mountPane();
    expect(rowNames("channels")).toHaveLength(500);
    expect(new Set(rowNames("channels")).size).toBe(500);
  });
});

describe("the filter and the search (R17)", () => {
  beforeEach(() => {
    h.store.setUnread("zeta", { count: 2, mention: false });
    h.store.setUnread("sec", { count: 1, mention: true });
  });

  test("each chip asks the store with its filter", async () => {
    await mountPane();
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(rowNames("channels")).toEqual(["secret", "zeta"]);
    await userEvent.click(screen.getByRole("button", { name: "Mentions" }));
    expect(rowNames("channels")).toEqual(["secret"]);
    expect(screen.getByRole("button", { name: "Mentions" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(rowNames("channels")).toHaveLength(3);
  });

  test("typing filters by name, and the empty state comes and Clear filter goes", async () => {
    await mountPane();
    await userEvent.type(screen.getByRole("searchbox"), "zeta");
    expect(rowNames("channels")).toEqual(["zeta"]);
    await userEvent.type(screen.getByRole("searchbox"), "qqq");
    expect(screen.getByText("No conversations match")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.queryByText("No conversations match")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("what is remembered on the device (R18, R19)", () => {
  const FILTER = "conversationList.filter";
  const COLLAPSED = "conversationList.collapsed";

  test("a stored unread is not restored while the read state is not available, but a press writes", async () => {
    device = fakeDevice({
      [FILTER]: JSON.stringify({ userId: ME, value: "unread" }),
    });
    await mountPane();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Mentions" }));
    expect(JSON.parse(device.data.get(FILTER)!)).toEqual({
      userId: ME,
      value: "mentions",
    });
  });

  test("collapsed groups are restored for the person, not for another", async () => {
    fakeDevice({
      [COLLAPSED]: JSON.stringify({ userId: "someone", value: ["channels"] }),
    });
    await mountPane();
    expect(group("channels")!.querySelector("button.sec")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("a press on a heading toggles it, writes it, and a filter change keeps it collapsed", async () => {
    device = fakeDevice();
    await mountPane();
    await userEvent.click(heading("channels"));
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
    expect(JSON.parse(device.data.get(COLLAPSED)!)).toEqual({
      userId: ME,
      value: ["channels"],
    });
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(heading("channels"));
    expect(heading("channels")).toHaveAttribute("aria-expanded", "true");
    expect(JSON.parse(device.data.get(COLLAPSED)!).value).toEqual([]);
  });

  test("a collapsed group stays collapsed when a new conversation arrives", async () => {
    device = fakeDevice();
    await mountPane();
    await userEvent.click(heading("channels"));
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
    const body = world();
    body.conversations.push(channel("new", "fresh"));
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(h.store.getState().conversations).toHaveProperty("new");
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
    expect(rowNames("channels")).toEqual([]);
  });

  test("a storage that refuses to write leaves the state in memory", async () => {
    device = fakeDevice();
    device.area.set = () => false;
    await mountPane();
    await userEvent.click(heading("channels"));
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("opening a row (R20)", () => {
  test("a click at / navigates with the fromList flag, and the row becomes current", async () => {
    const { router } = await mountPane();
    await userEvent.click(screen.getByText("general"));
    expect(router.state.location.pathname).toBe("/c/gen");
    expect(router.state.location.state.fromList).toBe(true);
    expect(
      group("channels")!.querySelector('a.cr[aria-current="page"]'),
    ).toHaveTextContent("general");
  });

  test("a click at another conversation carries no flag and aria-current moves", async () => {
    const { router } = await mountPane({ path: "/c/gen" });
    await userEvent.click(screen.getByText("zeta"));
    expect(router.state.location.pathname).toBe("/c/zeta");
    expect(router.state.location.state.fromList).toBeUndefined();
    const current = document.querySelectorAll('a.cr[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("zeta");
  });

  test("a push, so Back returns", async () => {
    const { router } = await mountPane();
    await userEvent.click(screen.getByText("general"));
    act(() => router.history.back());
    await act(async () => {});
    expect(router.state.location.pathname).toBe("/");
  });

  test("at another section no row is current", async () => {
    await mountPane({ path: "/activity" });
    expect(document.querySelector('a.cr[aria-current="page"]')).toBeNull();
  });
});

describe("the controls that need an opener (R25, R33)", () => {
  test("none of the three is drawn without a registration", async () => {
    await mountPane();
    expect(
      screen.queryByRole("button", { name: "Browse channels" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "New message" })).toBeNull();
  });

  test("each control calls its opener with the pressed control to return focus to", async () => {
    const browse = vi.fn();
    const start = vi.fn();
    await mountPane({
      actions: { browseChannels: browse, startDirect: start },
    });
    const buttons = screen.getAllByRole("button", { name: "Browse channels" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      await userEvent.click(button);
      expect(browse.mock.lastCall![0].returnFocusRef.current).toBe(button);
    }
    const plus = screen.getByRole("button", { name: "New message" });
    await userEvent.click(plus);
    expect(start.mock.lastCall![0].returnFocusRef.current).toBe(plus);
  });

  test("a Member and an Admin get the same set of controls, and none creates a channel", async () => {
    const opener = { browseChannels: vi.fn(), startDirect: vi.fn() };
    const controls = () =>
      [...document.querySelectorAll("button, a, input")]
        .map((el) => {
          const label =
            el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
          return `${el.tagName}:${el.getAttribute("type") ?? ""}:${el.className.split(" ")[0]}:${label}`;
        })
        .sort();
    await mountPane({ actions: opener });
    const member = controls();
    document.body.innerHTML = "";
    const body = world();
    body.user.role = "admin";
    h = useFakeStore(body);
    await h.loadNow();
    await mountPane({ actions: opener });
    expect(controls()).toEqual(member);
    const allowed = [
      /^BUTTON:[a-z]*:[a-z-]*:Browse channels$/, // the header button and the Browse row
      /^INPUT:search:[^:]*:/, // the search field
      /^BUTTON:[a-z]*:chip:(All|Unread|Mentions)$/, // the chips
      /^BUTTON:[a-z]*:sec:/, // a group heading
      /^BUTTON:[a-z]*:[a-z-]*:New message$/, // the '+'
      /^A:[a-z]*:cr:/, // a row
      /^BUTTON:[a-z]*:[a-z-]*:Clear filter$/,
    ];
    for (const c of member) {
      expect(
        allowed.some((re) => re.test(c)),
        c,
      ).toBe(true);
    }
    expect(member.some((c) => /create/i.test(c))).toBe(false);
  });
});

describe("the texts (R27)", () => {
  test("in English the headings, chips and placeholder are English", async () => {
    await mountPane({ language: "en" });
    expect(heading("starred")).toHaveTextContent("Starred");
    expect(heading("channels")).toHaveTextContent("Channels");
    expect(heading("direct")).toHaveTextContent("Direct messages");
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unread" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mentions" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search conversations")).toBeTruthy();
  });

  test("in Vietnamese the headings, chips and placeholder are Vietnamese", async () => {
    await mountPane({ language: "vi" });
    expect(heading("starred")).toHaveTextContent("Đã gắn sao");
    expect(heading("channels")).toHaveTextContent("Kênh");
    expect(heading("direct")).toHaveTextContent("Tin nhắn riêng");
    expect(screen.getByRole("button", { name: "Tất cả" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chưa đọc" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lượt nhắc" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Tìm hội thoại")).toBeTruthy();
  });
});

describe("the list follows the store (R29)", () => {
  test("a joined channel appears, a left one goes, a star and a mute move the row", async () => {
    h.answer(world());
    await mountPane();
    expect(rowNames("channels")).not.toContain("extra");
    const body = world();
    body.conversations.push(channel("x", "extra"));
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(rowNames("channels")).toContain("extra");

    body.conversations = body.conversations.filter((c) => c.id !== "zeta");
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(rowNames("channels")).not.toContain("zeta");

    body.conversations = body.conversations.map((c) =>
      c.id === "extra" || c.id === "x" ? { ...c, isStarred: true } : c,
    );
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(rowNames("starred")).toContain("extra");

    act(() => h.store.setUnread("gen", { count: 5, mention: false }));
    expect(group("channels")!.querySelector("a.cr.un .nm")).toHaveTextContent(
      "general",
    );
  });

  test("a mute changes the row: it no longer counts as unread", async () => {
    await mountPane();
    act(() => h.store.setUnread("gen", { count: 5, mention: false }));
    expect(group("channels")!.querySelector("a.cr.un .nm")).toHaveTextContent(
      "general",
    );
    const body = world();
    body.conversations = body.conversations.map((c) =>
      c.id === "gen" ? { ...c, isMuted: true } : c,
    );
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(group("channels")!.querySelector("a.cr.un")).toBeNull();
    expect(rowNames("channels")).toContain("general");
  });

  test("a refresh in progress does not re-render the pane", async () => {
    const { renders } = await mountPane();
    const before = renders.mock.calls.length;
    const release = h.holdNext();
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = h.store.refresh();
    });
    expect(h.store.getState().isRefreshing).toBe(true);
    expect(renders.mock.calls.length).toBe(before);
    release();
    await act(async () => void (await refreshing));
  });
});

describe("a conversation that opens is shown (R34)", () => {
  beforeEach(() => {
    h.store.setUnread("zeta", { count: 2, mention: false });
  });

  test("a filter that hides it becomes All, the search empties, the row shows", async () => {
    const { router } = await mountPane();
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(rowNames("channels")).toEqual(["zeta"]);
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "gen" },
      });
    });
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(rowNames("channels")).toContain("general");
    expect(JSON.parse(device.data.get("conversationList.filter")!).value).toBe(
      "all",
    );
  });

  test("a typed search that hides it is emptied", async () => {
    const { router } = await mountPane();
    await userEvent.type(screen.getByRole("searchbox"), "zeta");
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "gen" },
      });
    });
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(rowNames("channels")).toContain("general");
  });

  test("a collapsed group that holds it is expanded and written", async () => {
    const { router } = await mountPane();
    await userEvent.click(heading("channels"));
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "gen" },
      });
    });
    expect(heading("channels")).toHaveAttribute("aria-expanded", "true");
    expect(
      JSON.parse(device.data.get("conversationList.collapsed")!).value,
    ).toEqual([]);
  });

  test("a conversation that is already drawn changes nothing, stored values stay", async () => {
    device = fakeDevice({
      "conversationList.collapsed": JSON.stringify({
        userId: ME,
        value: ["direct"],
      }),
    });
    const { router } = await mountPane();
    const before = [...device.data.entries()];
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "gen" },
      });
    });
    expect([...device.data.entries()]).toEqual(before);
    expect(heading("direct")).toHaveAttribute("aria-expanded", "false");
  });

  test("choosing Unread while a conversation is open keeps it chosen", async () => {
    await mountPane({ path: "/c/gen" });
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(screen.getByRole("button", { name: "Unread" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(rowNames("channels")).toEqual(["zeta"]);
  });

  test("a first render at /c/x and the replace of R23 with the flag change nothing", async () => {
    device = fakeDevice({
      "conversationList.collapsed": JSON.stringify({
        userId: ME,
        value: ["channels"],
      }),
    });
    const { router } = await mountPane({ path: "/c/gen" });
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "zeta" },
        replace: true,
        state: { opening: true },
      });
    });
    expect(heading("channels")).toHaveAttribute("aria-expanded", "false");
  });

  test("an id the store does not hold changes nothing", async () => {
    const { router } = await mountPane();
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "nope" },
      });
    });
    expect(screen.getByRole("button", { name: "Unread" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a conversation that arrives in the store and is then opened is revealed", async () => {
    const { router } = await mountPane();
    await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    const body = world();
    body.conversations.push(channel("new", "fresh"));
    h.answer(body);
    await act(async () => void (await h.store.refresh()));
    expect(rowNames("channels")).not.toContain("fresh");
    await act(async () => {
      await router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: "new" },
      });
    });
    expect(rowNames("channels")).toContain("fresh");
  });
});

describe("before the data (R24)", () => {
  test("an idle store draws the header, the search, the chips and a busy list with no row", async () => {
    h = useFakeStore(world());
    await mountPane();
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(document.querySelector(".clist")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(document.querySelectorAll("a.cr")).toHaveLength(0);
  });

  test("a ready store is not busy", async () => {
    await mountPane();
    expect(document.querySelector(".clist")).not.toHaveAttribute("aria-busy");
  });
});
