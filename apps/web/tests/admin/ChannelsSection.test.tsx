// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { Icon } from "@toki/ui-web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { ChannelsSection } from "../../src/admin/ChannelsSection";
import {
  channel,
  createFakeAdminServer,
  failWith,
  hold,
  manyChannels,
  type FakeAdminServerOptions,
} from "../support/fakeAdminServer";
import { installFakeIntersectionObserver } from "../support/fakeIntersection";

let io: ReturnType<typeof installFakeIntersectionObserver>;

beforeEach(() => {
  io = installFakeIntersectionObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(
  options: FakeAdminServerOptions = {},
  props: React.ComponentProps<typeof ChannelsSection> = {},
  language: Language = "en",
) {
  const server = createFakeAdminServer(options).install();
  const forbidden = vi.fn();
  const view = render(
    <I18nProvider language={language}>
      <AdminForbiddenContext.Provider value={forbidden}>
        <ChannelsSection {...props} />
      </AdminForbiddenContext.Provider>
    </I18nProvider>,
  );
  return { server, forbidden, ...view };
}

const bodyRows = () => screen.queryAllByRole("row");

describe("the Channels section (R25)", () => {
  it("has the heading Channels and a table named by it", async () => {
    setup({ channels: manyChannels(3) });
    expect(
      screen.getByRole("heading", { level: 2, name: "Channels" }),
    ).toBeTruthy();
    const table = await screen.findByRole("table", { name: "Channels" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("shows each channel with an icon, its name and its member count with the plural form", async () => {
    setup({
      channels: [
        channel(1, { name: "general", memberCount: 12 }),
        channel(2, { name: "secret", isPrivate: true, memberCount: 1 }),
        channel(3, { name: "empty", memberCount: 0 }),
      ],
    });
    const rows = await screen.findAllByRole("row");
    expect(rows[0]).toHaveTextContent("general");
    expect(rows[0]).toHaveTextContent("12 members");
    expect(rows[1]).toHaveTextContent("secret");
    expect(rows[1]).toHaveTextContent("1 member");
    expect(rows[1]).not.toHaveTextContent("1 members");
    expect(rows[2]).toHaveTextContent("0 members");
  });

  it("draws a lock for a private channel and a hash for a public one", async () => {
    // The drawing of each icon, taken from the icon component itself.
    const drawing = (name: "lock" | "hash") =>
      render(<Icon name={name} />).container.querySelector("svg")!.innerHTML;
    const lock = drawing("lock");
    const hash = drawing("hash");
    expect(lock).not.toBe(hash);
    cleanup();

    setup({
      channels: [
        channel(1, { name: "open" }),
        channel(2, { name: "closed", isPrivate: true }),
      ],
    });
    const rows = await screen.findAllByRole("row");
    expect(rows[0]?.querySelector("svg")?.innerHTML).toBe(hash);
    expect(rows[1]?.querySelector("svg")?.innerHTML).toBe(lock);
  });

  it("marks an archived channel with a tag", async () => {
    setup({
      channels: [channel(1, { name: "old", archived: true }), channel(2)],
    });
    const rows = await screen.findAllByRole("row");
    expect(within(rows[0]!).getByText("Archived")).toBeTruthy();
    expect(within(rows[1]!).queryByText("Archived")).toBeNull();
  });

  it("keeps the server's order and leads nowhere", async () => {
    const { container } = setup({
      channels: [channel(3, { name: "zed" }), channel(1, { name: "amy" })],
    });
    const rows = await screen.findAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("zed"),
      expect.stringContaining("amy"),
    ]);
    expect(container.querySelector("a, [href]")).toBeNull();
  });

  it("reads the plural in Vietnamese", async () => {
    setup({ channels: [channel(1, { memberCount: 3 })] }, {}, "vi");
    expect(await screen.findByText("3 thành viên")).toBeTruthy();
  });
});

describe("its own states (R25, R32)", () => {
  it("shows a loading line, then the rows", async () => {
    const gate = hold();
    setup({ channels: manyChannels(2), gate: () => gate.promise });
    expect(screen.getByRole("status")).toHaveTextContent("Loading channels");
    gate.release();
    await screen.findByRole("table");
  });

  it("shows the error with its ID and a Retry that asks again", async () => {
    let fail = true;
    const { server } = setup({
      channels: manyChannels(2),
      fail: () => (fail ? failWith(500, "internal_error", "req-4") : undefined),
    });
    expect(
      await screen.findByText("Could not load the channels."),
    ).toBeTruthy();
    expect(screen.getByText("Error ID: req-4")).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("table");
    expect(server.calls.filter((c) => c.path === "/channels").length).toBe(2);
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
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("a 403 tells the page", async () => {
    const { forbidden } = setup({ fail: () => failWith(403, "forbidden") });
    await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
  });

  it("keeps the rows when a later page fails, with a Retry line", async () => {
    let fail = false;
    const { server } = setup({
      channels: manyChannels(120),
      fail: (call) =>
        fail && call.query.cursor ? failWith(500, "internal_error") : undefined,
    });
    await screen.findByRole("table");
    fail = true;
    io.live().at(-1)?.trigger(true);
    expect(
      await screen.findByText("Could not load the channels."),
    ).toBeTruthy();
    expect(bodyRows()).toHaveLength(50);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(100));
    expect(server.calls.filter((c) => c.query.cursor === "o:50")).toHaveLength(
      2,
    );
  });
});

describe("more on scroll (R25)", () => {
  it("asks the next page when the sentinel comes into view, once, and shows each channel once", async () => {
    const { server } = setup({ channels: manyChannels(120) });
    await screen.findByRole("table");
    expect(io.live().at(-1)?.rootMargin).toBe("0px 0px 48px 0px");
    io.live().at(-1)?.trigger(true);
    await waitFor(() => expect(bodyRows()).toHaveLength(100));
    io.live().at(-1)?.trigger(true);
    await waitFor(() => expect(bodyRows()).toHaveLength(120));
    expect(server.calls.filter((c) => c.query.cursor)).toHaveLength(2);
  });
});

describe("the place for the Create channel button (R25)", () => {
  it("draws a stand-in once in the heading row and gives it the list's reload", async () => {
    const seen: Array<() => void> = [];
    setup(
      { channels: manyChannels(2) },
      {
        headingAction: (reload) => {
          seen.push(reload);
          return <button type="button">plus</button>;
        },
      },
    );
    await screen.findByRole("table");
    expect(screen.getAllByRole("button", { name: "plus" })).toHaveLength(1);
    const heading = screen.getByRole("heading", { level: 2, name: "Channels" });
    expect(heading.parentElement).toContainElement(
      screen.getByRole("button", { name: "plus" }),
    );
    expect(typeof seen.at(-1)).toBe("function");
  });

  it("the reload that the stand-in gets asks the first page again", async () => {
    let reload: (() => void) | undefined;
    const { server } = setup(
      { channels: manyChannels(2) },
      {
        headingAction: (r) => {
          reload = r;
          return null;
        },
      },
    );
    await screen.findByRole("table");
    reload?.();
    await waitFor(() =>
      expect(server.calls.filter((c) => c.path === "/channels")).toHaveLength(
        2,
      ),
    );
  });

  it("draws no plus when there is no stand-in", async () => {
    setup({ channels: manyChannels(2) });
    await screen.findByRole("table");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
