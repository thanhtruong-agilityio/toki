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
import { useRef, useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ListActionsProvider,
  useListActions,
} from "../../src/conversation-list/list-actions";
import { ConversationStarters } from "../../src/features/ConversationStarters";
import { setConnectionCheck } from "../../src/patterns/online";
import {
  detail,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { channel, workspaceBody } from "../support/conversation-store";
import { Providers } from "../support/providers";
import { fake, resetFake } from "../features/fakeDeps";

// The dialog's own seam (features/deps) is the fake of TOKI-034; the store behind the Restore
// button is the real one over the fake api (src/client).
vi.mock("../../src/features/deps", async () =>
  (await import("../features/fakeDeps")).makeDepsMock(),
);
vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useRouter: () => ({ navigate }),
}));

let h: FakeApiHarness;

const summaryRow = (over: Record<string, unknown> = {}) => ({
  id: "x",
  name: "design",
  topic: null,
  isPrivate: false,
  isGeneral: false,
  archived: true,
  memberCount: 2,
  isMember: true,
  ...over,
});

async function setup(role: "member" | "admin", rows = [summaryRow()]) {
  resetFake();
  navigate.mockReset();
  setConnectionCheck(null);
  const body = workspaceBody([channel("gen", "general", { isGeneral: true })]);
  body.user = { ...body.user, role };
  h = useFakeApi(body, {
    details: [detail("x", "design", { archived: true })],
  });
  await h.loadNow();
  fake.list.mockResolvedValue({ channels: rows, nextCursor: null });
}

function Controls() {
  const actions = useListActions();
  const ref = useRef<HTMLButtonElement>(null);
  const directRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {actions.browseChannels ? (
        <button
          ref={ref}
          type="button"
          onClick={() => actions.browseChannels?.({ returnFocusRef: ref })}
        >
          browse control
        </button>
      ) : null}
      {actions.startDirect ? (
        <button
          ref={directRef}
          type="button"
          onClick={() => actions.startDirect?.({ returnFocusRef: directRef })}
        >
          direct control
        </button>
      ) : null}
    </>
  );
}

function Host() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Providers>
        <ListActionsProvider>
          <Controls />
          <ConversationStarters />
        </ListActionsProvider>
      </Providers>
    </QueryClientProvider>
  );
}

async function openBrowse() {
  const user = userEvent.setup();
  render(<Host />);
  await user.click(screen.getByText("browse control"));
  await screen.findByRole("dialog", { name: "Browse channels" });
  return user;
}

const rowButtons = async () => {
  const item = (await screen.findByText("design")).closest("li")!;
  return within(item)
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? b.textContent);
};

beforeEach(() => setConnectionCheck(null));

describe("the row of an archived channel (R18)", () => {
  test("an Admin member sees the label, Open and Restore, in that order", async () => {
    await setup("admin");
    await openBrowse();
    const item = (await screen.findByText("design")).closest("li")!;
    expect(within(item).getByText("Archived")).toBeInTheDocument();
    expect(await rowButtons()).toEqual(["Open", "Restore #design"]);
    expect(item.textContent!.indexOf("Archived")).toBeLessThan(
      item.textContent!.indexOf("Open"),
    );
  });

  test("an Admin who is not a member sees the label only, besides Restore", async () => {
    await setup("admin", [summaryRow({ isMember: false })]);
    await openBrowse();
    expect(await rowButtons()).toEqual(["Restore #design"]);
  });

  test("a Member sees the label and Open, no Restore", async () => {
    await setup("member");
    await openBrowse();
    expect(await rowButtons()).toEqual(["Open"]);
  });

  test("an active channel shows no Restore", async () => {
    await setup("admin", [summaryRow({ archived: false })]);
    await openBrowse();
    expect(await rowButtons()).toEqual(["Open"]);
  });

  test("a private archived channel the Admin belongs to shows it", async () => {
    await setup("admin", [summaryRow({ isPrivate: true })]);
    await openBrowse();
    expect(await rowButtons()).toEqual(["Open", "Restore #design"]);
  });
});

describe("Restore from the row (R19, R20)", () => {
  test("after a restore the list is asked again: no label, no button, the store has the channel and the dialog stays", async () => {
    await setup("admin");
    fake.list
      .mockResolvedValueOnce({ channels: [summaryRow()], nextCursor: null })
      .mockResolvedValue({
        channels: [summaryRow({ archived: false })],
        nextCursor: null,
      });
    h.answer(
      workspaceBody([
        channel("gen", "general", { isGeneral: true }),
        channel("x", "design"),
      ]),
    );
    const user = await openBrowse();
    await user.click(
      await screen.findByRole("button", { name: "Restore #design" }),
    );
    expect(h.api.channels.restore).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(screen.getByText("Restored #design")).toBeInTheDocument(),
    );
    await waitFor(() => expect(fake.list).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Restore #design" }),
      ).toBeNull(),
    );
    const item = screen.getByText("design").closest("li")!;
    expect(within(item).queryByText("Archived")).toBeNull();
    expect(h.store.hasConversation("x")).toBe(true);
    expect(
      screen.getByRole("dialog", { name: "Browse channels" }),
    ).toBeInTheDocument();
  });

  test("the dialog closed while the request ran: onChanged does nothing and nothing throws", async () => {
    await setup("admin");
    const user = await openBrowse();
    await user.click(
      await screen.findByRole("button", { name: "Restore #design" }),
    );
    let release: () => void = () => {};
    h.api.channels.restore.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details["x"], changed: true });
        }),
    );
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await user.keyboard("{Escape}");
    await act(async () => {
      release();
    });
    await act(async () => {});
    expect(h.api.channels.restore).toHaveBeenCalledOnce();
  });
});

describe("opening an archived channel from Browse (plan 7e)", () => {
  test("an id the store does not hold is read before the person moves", async () => {
    await setup("member");
    let release: () => void = () => {};
    fake.readChannel.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        }),
    );
    const user = await openBrowse();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(fake.readChannel).toHaveBeenCalledWith("x");
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => {
      release();
    });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/c/$conversationId",
        params: { conversationId: "x" },
      }),
    );
  });

  test("a failed read does not stop the move", async () => {
    await setup("member");
    fake.readChannel.mockRejectedValueOnce(new Error("down"));
    const user = await openBrowse();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  test("a direct message goes straight to its address with no channel read", async () => {
    await setup("member");
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByText("direct control"));
    await user.click(await screen.findByRole("button", { name: /Person 001/ }));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/c/$conversationId",
        params: { conversationId: "c1" },
      }),
    );
    expect(fake.readChannel).not.toHaveBeenCalled();
  });

  test("an id the store holds moves at once and reads nothing", async () => {
    await setup("member");
    fake.hasConversation.mockImplementation(() => true);
    const user = await openBrowse();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(fake.readChannel).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
  });
});

void fireEvent;
