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
import type { MemberStatus } from "@toki/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { MembersSection } from "../../src/admin/MembersSection";
import { useMemberList } from "../../src/admin/useMemberList";
import {
  createFakeAdminServer,
  type FakeAdminServer,
  failWith,
  hold,
  invitation,
  manyMembers,
  person,
  type FakeAdminServerOptions,
  type FakeMember,
} from "../support/fakeAdminServer";
import { installFakeIntersectionObserver } from "../support/fakeIntersection";
import { Providers } from "../support/providers";

let io: ReturnType<typeof installFakeIntersectionObserver>;

beforeEach(() => {
  io = installFakeIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ADMIN = { id: "u-001", role: "admin" };

function Harness(props: {
  renderActions?: (row: { email: string }) => React.ReactNode;
}) {
  const list = useMemberList();
  return (
    <MembersSection
      list={list}
      actor={ADMIN}
      renderActions={props.renderActions}
    />
  );
}

function setup(
  options: FakeAdminServerOptions = {},
  props: React.ComponentProps<typeof Harness> = {},
) {
  const server = createFakeAdminServer(options).install();
  const view = render(
    <Providers>
      <AdminForbiddenContext.Provider value={() => undefined}>
        <Harness {...props} />
      </AdminForbiddenContext.Provider>
    </Providers>,
  );
  return { server, ...view };
}

const bodyRows = () => {
  const table = screen.queryByRole("table");
  return table
    ? within(table)
        .getAllByRole("row")
        .filter((row) => row.parentElement?.tagName === "TBODY")
    : [];
};

const calls = (server: FakeAdminServer) =>
  server.calls.filter((c) => c.path === "/members");

// Scroll to the end: the sentinel comes into view until no page is left.
async function scrollToEnd() {
  for (let i = 0; i < 6; i += 1) {
    const before = bodyRows().length;
    await act(async () => {
      io.live().at(-1)?.trigger(true);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    if (bodyRows().length === before) return;
  }
}

describe("the table (R11)", () => {
  it("is named by the section heading and has five columns, the last one hidden visually", async () => {
    setup({ members: [person({ n: 1 }), person({ n: 2 })] });
    const table = await screen.findByRole("table", { name: "Members" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Members" }),
    ).toHaveAttribute("tabindex", "-1");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Name",
      "Role",
      "Status",
      "Last active",
      "Actions",
    ]);
    expect(headers[4]).toHaveClass("sr");
    expect(bodyRows()).toHaveLength(2);
  });

  it("keeps the order of the server and sorts nothing", async () => {
    setup({
      members: [
        person({ n: 3, displayName: "Zed" }),
        person({ n: 1, displayName: "Amy" }),
      ],
    });
    await screen.findByRole("table");
    expect(
      bodyRows().map((r) => within(r).getAllByRole("cell")[0]?.textContent),
    ).toEqual([expect.stringContaining("Zed"), expect.stringContaining("Amy")]);
  });

  it("leads nowhere: no link in the page", async () => {
    const { container } = setup({
      members: [person({ n: 1 }), invitation({ n: 2 })],
    });
    await screen.findByRole("table");
    expect(container.querySelector("a, [href]")).toBeNull();
  });
});

describe("search (R7)", () => {
  it("sends one request for five key presses inside 300 ms and two when they are 301 ms apart", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { server } = setup({ members: manyMembers(5) });
    const box = await screen.findByRole("textbox", {
      name: "Search members",
    });
    const press = (value: string) =>
      fireEvent.change(box, { target: { value } });
    for (const value of ["m", "me", "mem", "memb", "membe"]) {
      press(value);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
    }
    expect(calls(server)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(calls(server)).toHaveLength(2));
    expect(calls(server)[1]?.query.search).toBe("membe");
    // 301 ms apart: each press makes its own request.
    press("member");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301);
    });
    await waitFor(() => expect(calls(server)).toHaveLength(3));
    press("member 0");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301);
    });
    await waitFor(() => expect(calls(server)).toHaveLength(4));
  });

  it("shows the typed text at once, sends it trimmed and keeps it out of the address", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { server } = setup({ members: manyMembers(3) });
    const box = await screen.findByRole("textbox", {
      name: "Search members",
    });
    fireEvent.change(box, { target: { value: "  member 001  " } });
    expect(box).toHaveValue("  member 001  ");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301);
    });
    await waitFor(() => expect(calls(server)).toHaveLength(2));
    expect(calls(server)[1]?.query.search).toBe("member 001");
    expect(window.location.search).toBe("");
    expect(window.localStorage.length).toBe(0);
  });

  it("has the placeholder and keeps the old rows, with aria-busy, while the answer is awaited", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const gate = hold();
    const { server } = setup({
      members: [person({ n: 1 }), person({ n: 2, displayName: "Lan" })],
      gate: (call) => (call.query.search === "lan" ? gate.promise : undefined),
    });
    const box = await screen.findByRole("textbox", {
      name: "Search members",
    });
    expect(box).toHaveAttribute("placeholder", "Search by name or address");
    fireEvent.change(box, { target: { value: "lan" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301);
    });
    await waitFor(() => expect(calls(server)).toHaveLength(2));
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(bodyRows()).toHaveLength(2);
    gate.release();
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
  });
});

describe("status chips (R8)", () => {
  const MIXED: FakeMember[] = [
    ...Array.from({ length: 60 }, (_, i) => person({ n: i + 1 })),
    ...Array.from({ length: 20 }, (_, i) =>
      person({ n: i + 61, status: "deactivated" }),
    ),
    ...Array.from({ length: 25 }, (_, i) => invitation({ n: i + 1 })),
    ...Array.from({ length: 15 }, (_, i) =>
      invitation({ n: i + 26, status: "expired" }),
    ),
  ];

  const chip = (name: RegExp) =>
    screen.getByRole("button", { name }) as HTMLButtonElement;

  it("shows five chips in order with their totals; All is the sum and is pressed at first", async () => {
    setup({ members: MIXED });
    const group = await screen.findByRole("group", {
      name: "Filter by status",
    });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual([
      "All 120",
      "Active 60",
      "Invited 25",
      "Expired 15",
      "Deactivated 20",
    ]);
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/^Active/)).toHaveAttribute("aria-pressed", "false");
  });

  it.each<[string, MemberStatus | undefined, RegExp]>([
    ["Active", "active", /^Active/],
    ["Invited", "invited", /^Invited/],
    ["Expired", "expired", /^Expired/],
    ["Deactivated", "deactivated", /^Deactivated/],
  ])(
    "the number on %s equals the rows its press shows, over 120 rows",
    async (_name, status, pattern) => {
      const { server } = setup({ members: MIXED });
      await screen.findByRole("table");
      const total = Number(chip(pattern).textContent?.match(/\d+$/)?.[0]);
      await userEvent.click(chip(pattern));
      await waitFor(() =>
        expect(server.calls.at(-1)?.query.status).toBe(status),
      );
      await waitFor(() =>
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false"),
      );
      await scrollToEnd();
      expect(bodyRows()).toHaveLength(total);
      expect(chip(pattern)).toHaveAttribute("aria-pressed", "true");
    },
  );

  it("the totals follow the search text, and a chip's number still equals its rows", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { server } = setup({ members: MIXED });
    const box = await screen.findByRole("textbox", {
      name: "Search members",
    });
    fireEvent.change(box, { target: { value: "member 06" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301);
    });
    await waitFor(() =>
      expect(server.calls.at(-1)?.query.search).toBe("member 06"),
    );
    // "Member 060" to "Member 069" are Active (60) and Deactivated (61 to 69) rows.
    await waitFor(() => expect(chip(/^All/).textContent).toBe("All 10"));
    const active = Number(chip(/^Active/).textContent?.match(/\d+$/)?.[0]);
    await userEvent.click(chip(/^Active/));
    await waitFor(() =>
      expect(server.calls.at(-1)?.query.status).toBe("active"),
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(active));
    // The totals did not change when the chip was pressed.
    expect(chip(/^All/).textContent).toBe("All 10");
  });

  it("pressing All clears the status", async () => {
    const { server } = setup({ members: MIXED });
    await screen.findByRole("table");
    await userEvent.click(chip(/^Invited/));
    await waitFor(() =>
      expect(server.calls.at(-1)?.query.status).toBe("invited"),
    );
    await userEvent.click(chip(/^All/));
    await waitFor(() =>
      expect(server.calls.at(-1)?.query.status).toBeUndefined(),
    );
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true");
  });

  it("a chip with a total of 0 is shown, can be pressed and gives the empty state", async () => {
    setup({ members: manyMembers(3) });
    await screen.findByRole("table");
    expect(chip(/^Expired/).textContent).toBe("Expired 0");
    await userEvent.click(chip(/^Expired/));
    expect(await screen.findByText("Nobody matches")).toBeInTheDocument();
    expect(screen.getByText("Try a name or an address.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("states (R14)", () => {
  it("shows a loading line with the role status until the first answer", async () => {
    const gate = hold();
    setup({ members: manyMembers(2), gate: () => gate.promise });
    expect(screen.getByRole("status")).toHaveTextContent("Loading members");
    gate.release();
    await screen.findByRole("table");
    expect(screen.queryByText("Loading members")).toBeNull();
  });

  it("shows the error with its error ID and a Retry that asks again", async () => {
    let fail = true;
    const { server } = setup({
      members: manyMembers(2),
      fail: () => (fail ? failWith(500, "internal_error", "req-9") : undefined),
    });
    expect(
      await screen.findByText("Could not load the members."),
    ).toBeInTheDocument();
    expect(screen.getByText("Error ID: req-9")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("table");
    expect(calls(server).length).toBeGreaterThanOrEqual(2);
  });

  it("shows no error ID line when the error has none", async () => {
    setup({ fail: () => failWith(500, "internal_error") });
    await screen.findByText("Could not load the members.");
    expect(screen.queryByText(/Error ID/)).toBeNull();
  });

  it("shows the unreadable text and no Retry when the answer does not fit the schema", async () => {
    setup({
      fail: () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    expect(
      await screen.findByText(
        "This page is out of date. Reload it to continue.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("keeps the table when a later refresh fails and offers a Retry line under it", async () => {
    let fail = false;
    const { server } = setup({
      members: manyMembers(120),
      fail: (call) =>
        fail && call.query.cursor ? failWith(500, "internal_error") : undefined,
    });
    await screen.findByRole("table");
    fail = true;
    await act(async () => {
      io.live().at(-1)?.trigger(true);
    });
    expect(
      await screen.findByText("Could not load the members."),
    ).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(50);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(100));
    expect(server.calls.filter((c) => c.query.cursor === "o:50")).toHaveLength(
      2,
    );
  });
});

describe("more on scroll (R9)", () => {
  it("has a sentinel after the last row watched with the scrolling ancestor and 48px", async () => {
    setup({ members: manyMembers(120) });
    await screen.findByRole("table");
    const observer = io.live().at(-1);
    expect(observer?.rootMargin).toBe("0px 0px 48px 0px");
    expect(observer?.observed.size).toBe(1);
  });

  it("asks the next page when the sentinel comes into view, aria-busy while it loads", async () => {
    const gate = hold();
    setup({
      members: manyMembers(120),
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
    });
    await screen.findByRole("table");
    await act(async () => {
      io.live().at(-1)?.trigger(true);
    });
    await waitFor(() =>
      expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true"),
    );
    gate.release();
    await waitFor(() => expect(bodyRows()).toHaveLength(100));
  });

  it("asks the page too when focus enters the last row, for a person with a keyboard only", async () => {
    const { server } = setup(
      { members: manyMembers(120) },
      {
        renderActions: (row) => <button type="button">act {row.email}</button>,
      },
    );
    await screen.findByRole("table");
    const last = bodyRows().at(-1)!;
    await act(async () => {
      within(last).getByRole("button").focus();
    });
    await waitFor(() =>
      expect(server.calls.filter((c) => c.query.cursor)).toHaveLength(1),
    );
  });
});
