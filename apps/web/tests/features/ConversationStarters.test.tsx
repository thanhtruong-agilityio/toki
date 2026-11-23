// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ListActionsProvider,
  useListActions,
} from "../../src/conversation-list/list-actions";
import { ConversationStarters } from "../../src/features/ConversationStarters";
import { Providers } from "../support/providers";
import { fake, resetFake } from "./fakeDeps";

vi.mock("../../src/features/deps", async () =>
  (await import("./fakeDeps")).makeDepsMock(),
);

const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useRouter: () => ({ navigate }),
}));

beforeEach(() => {
  resetFake();
  navigate.mockReset();
  fake.list.mockResolvedValue({
    channels: [
      {
        id: "x",
        name: "design",
        topic: null,
        isPrivate: false,
        isGeneral: false,
        archived: false,
        memberCount: 2,
        isMember: true,
      },
    ],
    nextCursor: null,
  });
});

// The controls TOKI-033 draws: each is drawn only while an opener is registered.
function Controls() {
  const actions = useListActions();
  const browseRef = useRef<HTMLButtonElement>(null);
  const directRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {actions.browseChannels ? (
        <button
          ref={browseRef}
          type="button"
          onClick={() =>
            actions.browseChannels?.({ returnFocusRef: browseRef })
          }
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

function Host({ mounted = true }: { mounted?: boolean }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Providers>
        <ListActionsProvider>
          <Controls />
          {mounted ? <ConversationStarters /> : null}
        </ListActionsProvider>
      </Providers>
    </QueryClientProvider>
  );
}

describe("ConversationStarters (TOKI-034 R30)", () => {
  test("the controls are drawn only while it is mounted", () => {
    const { rerender } = render(<Host />);
    expect(screen.getByText("browse control")).toBeInTheDocument();
    expect(screen.getByText("direct control")).toBeInTheDocument();
    rerender(<Host mounted={false} />);
    expect(screen.queryByText("browse control")).toBeNull();
    expect(screen.queryByText("direct control")).toBeNull();
  });

  test("no request is made and no dialog is drawn until a control is pressed", () => {
    render(<Host />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fake.list).not.toHaveBeenCalled();
  });

  test("the browse opener opens Browse channels and focus returns to the control on close", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const control = screen.getByText("browse control");
    await user.click(control);
    expect(
      await screen.findByRole("dialog", { name: "Browse channels" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(control).toHaveFocus();
  });

  test("the direct opener opens New message and focus returns to its control", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const control = screen.getByText("direct control");
    await user.click(control);
    expect(
      await screen.findByRole("dialog", { name: "New message" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(control).toHaveFocus();
  });

  test("calling one opener while the other dialog is open closes that one: at most one is open", async () => {
    // The open dialog hides the page, so the second opener is called as TOKI-071's palette would.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Host />);
    await user.click(screen.getByText("browse control"));
    await screen.findByRole("dialog", { name: "Browse channels" });
    await user.click(screen.getByText("direct control"));
    await screen.findByRole("dialog", { name: "New message" });
    expect(
      screen.queryByRole("dialog", { name: "Browse channels" }),
    ).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  test("Open on a channel closes the dialog and navigates to /c/x", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByText("browse control"));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/c/$conversationId",
      params: { conversationId: "x" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("starting a conversation closes the dialog and navigates", async () => {
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
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
