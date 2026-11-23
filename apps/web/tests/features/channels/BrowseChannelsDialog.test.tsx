// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { ErrorCodes } from "@toki/shared";
import { useRef, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BrowseChannelsDialog } from "../../../src/features/channels/BrowseChannelsDialog";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { fake, resetFake } from "../fakeDeps";

vi.mock("../../../src/features/deps", async () =>
  (await import("../fakeDeps")).makeDepsMock(),
);

const channel = (n: number, over: Record<string, unknown> = {}) => ({
  id: `c${n}`,
  name: `channel-${String(n).padStart(3, "0")}`,
  topic: n % 2 === 0 ? `Topic ${n}` : null,
  isPrivate: false,
  isGeneral: false,
  archived: false,
  memberCount: n,
  isMember: false,
  ...over,
});
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => channel(from + i));
const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code });

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

type HostProps = {
  onClose?: () => void;
  onOpenConversation?: (id: string) => void;
  rowExtra?: (channel: unknown, reset: () => void) => ReactNode;
  initialSearch?: string;
};

function Host({
  onClose,
  onOpenConversation,
  rowExtra,
  initialSearch,
}: HostProps) {
  const [open, setOpen] = useState(true);
  const client = useRef(new QueryClient()).current;
  return (
    <QueryClientProvider client={client}>
      <Providers>
        <button type="button" onClick={() => setOpen(true)}>
          opener
        </button>
        <BrowseChannelsDialog
          open={open}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          onOpenConversation={onOpenConversation ?? (() => {})}
          initialSearch={initialSearch}
          rowExtra={rowExtra as never}
        />
      </Providers>
    </QueryClientProvider>
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Browse channels" });
const search = () => screen.getByRole("searchbox", { name: "Search channels" });
const list = () => dialog().querySelector(".mlist") as HTMLElement;

function scrollToEnd(el: HTMLElement) {
  Object.defineProperty(el, "scrollTop", {
    value: 900,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(el, "clientHeight", { value: 300, configurable: true });
  Object.defineProperty(el, "scrollHeight", {
    value: 1200,
    configurable: true,
  });
  fireEvent.scroll(el);
}

describe("BrowseChannelsDialog (TOKI-034 R4 to R15)", () => {
  test("opens with the title, a search input with the attributes of R4, and asks the first page", async () => {
    fake.list.mockResolvedValue({ channels: range(1, 2), nextCursor: null });
    render(<Host />);
    const input = search();
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("maxlength", "80");
    expect(input).toHaveAttribute("placeholder", "Search channels");
    expect(input).toHaveAttribute("data-autofocus");
    expect(input).toHaveFocus();
    expect(input.closest("label")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    await screen.findByText("channel-001");
    expect(fake.list).toHaveBeenCalledWith({
      search: undefined,
      limit: 50,
      cursor: undefined,
    });
  });

  test("initialSearch fills the input and is sent", async () => {
    fake.list.mockResolvedValue({ channels: [], nextCursor: null });
    render(<Host initialSearch="des" />);
    expect(search()).toHaveValue("des");
    await waitFor(() =>
      expect(fake.list).toHaveBeenCalledWith({
        search: "des",
        limit: 50,
        cursor: undefined,
      }),
    );
  });

  test("shows loading while the first page is on its way", async () => {
    let release: (v: unknown) => void = () => {};
    fake.list.mockReturnValue(new Promise((r) => (release = r)));
    render(<Host />);
    expect(list()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading channels")).toHaveClass("muted");
    await act(async () => release({ channels: [], nextCursor: null }));
  });

  test("an answer of no channels shows the message and is-empty", async () => {
    fake.list.mockResolvedValue({ channels: [], nextCursor: null });
    render(<Host />);
    expect(await screen.findByText("No channels match")).toBeInTheDocument();
    expect(list()).toHaveClass("is-empty");
  });

  test("the first page fails: the line and Retry; Retry asks again and the search keeps its text", async () => {
    const user = userEvent.setup();
    fake.list.mockRejectedValueOnce(new Error("down"));
    fake.list.mockResolvedValueOnce({
      channels: range(1, 1),
      nextCursor: null,
    });
    render(<Host initialSearch="x" />);
    expect(
      await screen.findByText("Channels could not be loaded."),
    ).toBeInTheDocument();
    expect(search()).toHaveValue("x");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("channel-001")).toBeInTheDocument();
  });

  test("120 channels in pages of 50: scrolling asks the next cursors once each", async () => {
    fake.list.mockImplementation(async (q: { cursor?: string }) =>
      q.cursor === undefined
        ? { channels: range(1, 50), nextCursor: "k2" }
        : q.cursor === "k2"
          ? { channels: range(51, 100), nextCursor: "k3" }
          : { channels: range(101, 120), nextCursor: null },
    );
    render(<Host />);
    await screen.findByText("channel-050");
    scrollToEnd(list());
    await screen.findByText("channel-100");
    scrollToEnd(list());
    await screen.findByText("channel-120");
    scrollToEnd(list());
    expect(fake.list).toHaveBeenCalledTimes(3);
    expect(dialog().querySelectorAll("li.prow")).toHaveLength(120);
  });

  test("a later page that fails keeps the rows and shows the line and Retry after them", async () => {
    fake.list
      .mockResolvedValueOnce({ channels: range(1, 2), nextCursor: "k2" })
      .mockRejectedValueOnce(new Error("down"));
    render(<Host />);
    await screen.findByText("channel-002");
    scrollToEnd(list());
    expect(
      await screen.findByText("Channels could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByText("channel-001")).toBeInTheDocument();
  });

  test("Join: offline sends nothing", async () => {
    const user = userEvent.setup();
    setConnectionCheck(() => false);
    fake.list.mockResolvedValue({ channels: range(1, 1), nextCursor: null });
    render(<Host />);
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(fake.joinChannel).not.toHaveBeenCalled();
    expect(dialog()).toBeInTheDocument();
  });

  test("Join: buttons are disabled while it runs; then the store, close, open and the toast, in order", async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    fake.list.mockResolvedValue({ channels: range(1, 2), nextCursor: null });
    let release: () => void = () => {};
    fake.joinChannel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            log.push("store");
            resolve();
          };
        }),
    );
    render(
      <Host
        onClose={() => log.push("close")}
        onOpenConversation={(id) => log.push(`open:${id}`)}
      />,
    );
    const joins = await screen.findAllByRole("button", { name: "Join" });
    await user.click(joins[0]!);
    const now = screen.getAllByRole("button", { name: "Join" });
    for (const b of now) expect(b).toBeDisabled();
    expect(now[0]).toHaveAttribute("aria-busy", "true");
    expect(now[1]).not.toHaveAttribute("aria-busy");
    await act(async () => release());
    expect(log).toEqual(["store", "close", "open:c1"]);
    expect(await screen.findByText("Joined #channel-001")).toBeInTheDocument();
  });

  test("Join: the dialog closed while the call is held still updates the store and shows the toast, and does not navigate", async () => {
    const user = userEvent.setup();
    fake.list.mockResolvedValue({ channels: range(1, 1), nextCursor: null });
    let release: () => void = () => {};
    fake.joinChannel.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const onOpen = vi.fn();
    render(<Host onOpenConversation={onOpen} />);
    await user.click(await screen.findByRole("button", { name: "Join" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => release());
    expect(await screen.findByText("Joined #channel-001")).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("Open asks nothing: it closes and opens", async () => {
    const user = userEvent.setup();
    fake.list.mockResolvedValue({
      channels: [channel(1, { isMember: true })],
      nextCursor: null,
    });
    const onClose = vi.fn();
    const onOpen = vi.fn();
    render(<Host onClose={onClose} onOpenConversation={onOpen} />);
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(fake.joinChannel).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("c1");
  });

  test("409 channel_archived returns to the first page, asks it again, and the row shows its label with no button", async () => {
    const user = userEvent.setup();
    fake.list
      .mockResolvedValueOnce({ channels: range(1, 2), nextCursor: null })
      .mockResolvedValueOnce({
        channels: [channel(1, { archived: true }), channel(2)],
        nextCursor: null,
      });
    fake.joinChannel.mockRejectedValue(http(409, ErrorCodes.channelArchived));
    render(<Host />);
    const joins = await screen.findAllByRole("button", { name: "Join" });
    await user.click(joins[0]!);
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);
    expect(fake.list).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
    expect(list().scrollTop).toBe(0);
  });

  test.each([
    [403, ErrorCodes.forbidden],
    [404, ErrorCodes.notFound],
    [500, ErrorCodes.internalError],
  ])(
    "a join that fails with %s shows one line above the list, keeps the rows, enables the buttons",
    async (status, code) => {
      const user = userEvent.setup();
      fake.list.mockResolvedValue({ channels: range(1, 2), nextCursor: null });
      fake.joinChannel.mockRejectedValue(http(status, code));
      render(<Host />);
      const joins = await screen.findAllByRole("button", { name: "Join" });
      await user.click(joins[0]!);
      const line = await screen.findByText("That did not work. Try again.");
      expect(line).toHaveAttribute("role", "alert");
      expect(
        line.compareDocumentPosition(list()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      for (const b of screen.getAllByRole("button", { name: "Join" })) {
        expect(b).toBeEnabled();
      }
    },
  );

  test.each(["admin", "member"] as const)(
    "with no rowExtra, a session of a %s sees only the close button and the row buttons; no create action",
    async (role) => {
      fake.people[0]!.role = role;
      fake.list.mockResolvedValue({
        channels: [channel(1), channel(2, { isMember: true })],
        nextCursor: null,
      });
      render(<Host />);
      await screen.findByText("channel-001");
      const names = within(dialog())
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label") ?? b.textContent);
      expect(names).toEqual(["Close", "Join", "Open"]);
      expect(within(dialog()).queryByText(/create|new channel/i)).toBeNull();
      expect(within(dialog()).queryAllByRole("link")).toHaveLength(0);
    },
  );

  test("while a later page is asked the container is busy, then it is not (R8)", async () => {
    let release: (v: unknown) => void = () => {};
    fake.list
      .mockResolvedValueOnce({ channels: range(1, 2), nextCursor: "k2" })
      .mockReturnValueOnce(new Promise((r) => (release = r)));
    render(<Host />);
    await screen.findByText("channel-002");
    expect(list()).not.toHaveAttribute("aria-busy");
    scrollToEnd(list());
    await waitFor(() => expect(list()).toHaveAttribute("aria-busy", "true"));
    await act(async () => release({ channels: range(3, 3), nextCursor: null }));
    await screen.findByText("channel-003");
    expect(list()).not.toHaveAttribute("aria-busy");
  });

  test("rowExtra is called for each row with the channel and reset, and its result is drawn after the row's button", async () => {
    fake.list.mockResolvedValue({ channels: range(1, 2), nextCursor: null });
    const calls: Array<[unknown, () => void]> = [];
    render(
      <Host
        rowExtra={(ch, reset) => {
          calls.push([ch, reset]);
          return <button type="button">Extra</button>;
        }}
      />,
    );
    await screen.findByText("channel-001");
    expect(screen.getAllByRole("button", { name: "Extra" })).toHaveLength(2);
    expect(calls.at(-1)![0]).toMatchObject({ id: "c2" });
    const li = dialog().querySelector("li")!;
    expect(
      Array.from(li.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["Join", "Extra"]);
  });

  test("the dialog closes only through onClose, for every reason, with no guard", async () => {
    const user = userEvent.setup();
    fake.list.mockResolvedValue({ channels: [], nextCursor: null });
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await user.type(search(), "abc");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("reopening asks again and starts with the search empty", async () => {
    const user = userEvent.setup();
    fake.list.mockResolvedValue({ channels: range(1, 1), nextCursor: null });
    render(<Host />);
    await user.type(search(), "abc");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const before = fake.list.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "opener" }));
    expect(search()).toHaveValue("");
    await waitFor(() =>
      expect(fake.list.mock.calls.length).toBeGreaterThan(before),
    );
  });

  test("no request is made while the dialog is closed", () => {
    fake.list.mockResolvedValue({ channels: [], nextCursor: null });
    function Closed() {
      return (
        <QueryClientProvider client={new QueryClient()}>
          <Providers>
            <BrowseChannelsDialog
              open={false}
              onClose={() => {}}
              onOpenConversation={() => {}}
            />
          </Providers>
        </QueryClientProvider>
      );
    }
    render(<Closed />);
    expect(fake.list).not.toHaveBeenCalled();
  });

  test("asks no function that reads messages (R15)", async () => {
    const user = userEvent.setup();
    fake.list.mockResolvedValue({ channels: range(1, 1), nextCursor: null });
    render(<Host />);
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(fake.readChannel).not.toHaveBeenCalled();
    expect(fake.openDirect).not.toHaveBeenCalled();
  });
});
