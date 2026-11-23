// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@toki/client-core";
import { ErrorCodes } from "@toki/shared";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NewMessageDialog } from "../../../src/features/people/NewMessageDialog";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { fake, makePeople, resetFake } from "../fakeDeps";

vi.mock("../../../src/features/deps", async () =>
  (await import("../fakeDeps")).makeDepsMock(),
);

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

function Host({
  onClose,
  onOpenConversation,
}: {
  onClose?: () => void;
  onOpenConversation?: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Providers>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <NewMessageDialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        onOpenConversation={onOpenConversation ?? (() => {})}
      />
    </Providers>
  );
}

const dialog = () => screen.getByRole("dialog", { name: "New message" });
const start = () => screen.getByRole("button", { name: "Start" });
const row = (n: number) =>
  screen.getByRole("button", { name: new RegExp(`Person 00${n}`) });
const http = (status: number, code: string, details?: unknown) =>
  new ApiError({ kind: "http", status, code, details });

describe("NewMessageDialog (TOKI-034 R21 to R25)", () => {
  test("lists the active people but the person themselves, in the store's order; focus is in the search", () => {
    fake.people[3]!.status = "deactivated"; // Person 003
    render(<Host />);
    const names = Array.from(dialog().querySelectorAll(".prow .grow")).map(
      (n) => n.textContent,
    );
    expect(names).toEqual([
      "Person 001",
      "Person 002",
      "Person 004",
      "Person 005",
    ]);
    expect(screen.queryByText("Me Myself")).toBeNull();
    expect(
      screen.getByRole("searchbox", { name: "Search people" }),
    ).toHaveFocus();
  });

  test("Start is disabled with no chip and enabled with one; the title states no kind", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(start()).toBeDisabled();
    await user.click(row(1));
    expect(start()).toBeEnabled();
    expect(within(dialog()).queryByText(/group/i)).toBeNull();
  });

  test("Start sends the ids in the order pressed without the caller, then closes and opens, with no toast", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpen = vi.fn();
    render(<Host onClose={onClose} onOpenConversation={onOpen} />);
    await user.click(row(3));
    await user.click(row(1));
    await user.click(start());
    expect(fake.openDirect).toHaveBeenCalledWith(["p3", "p1"]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("c1");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a 200 for the same people is handled as a 201", async () => {
    const user = userEvent.setup();
    fake.openDirect.mockResolvedValue({ id: "c7", created: false });
    const onOpen = vi.fn();
    render(<Host onOpenConversation={onOpen} />);
    await user.click(row(2));
    await user.click(start());
    expect(onOpen).toHaveBeenCalledWith("c7");
  });

  test("Start is disabled while the call is held", async () => {
    const user = userEvent.setup();
    let release: (v: unknown) => void = () => {};
    fake.openDirect.mockReturnValue(new Promise((r) => (release = r)));
    render(<Host />);
    await user.click(row(1));
    await user.click(start());
    expect(start()).toBeDisabled();
    expect(start()).toHaveAttribute("aria-busy", "true");
    await act(async () => release({ id: "c1", created: true }));
  });

  test("offline: nothing is sent and the dialog stays", async () => {
    const user = userEvent.setup();
    setConnectionCheck(() => false);
    render(<Host />);
    await user.click(row(1));
    await user.click(start());
    expect(fake.openDirect).not.toHaveBeenCalled();
    expect(dialog()).toBeInTheDocument();
  });

  test("409 person_deactivated drops those people, reads the people again and says so", async () => {
    const user = userEvent.setup();
    fake.openDirect.mockRejectedValue(
      http(409, ErrorCodes.personDeactivated, { userIds: ["p2"] }),
    );
    render(<Host />);
    await user.click(row(1));
    await user.click(row(2));
    await user.click(start());
    expect(fake.refresh).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        "Some people are no longer active. They were removed from your choice.",
      ),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.queryByRole("button", { name: "Remove Person 002" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove Person 001" }),
    ).toBeInTheDocument();
    expect(start()).toBeEnabled();
  });

  test("400 group_too_large shows the limit and keeps the chips", async () => {
    const user = userEvent.setup();
    fake.openDirect.mockRejectedValue(http(400, ErrorCodes.groupTooLarge));
    render(<Host />);
    await user.click(row(1));
    await user.click(start());
    expect(
      await screen.findByText("Up to 8 people, counting you"),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByRole("button", { name: "Remove Person 001" }),
    ).toBeInTheDocument();
  });

  test.each([
    [404, ErrorCodes.notFound],
    [403, ErrorCodes.forbidden],
    [400, ErrorCodes.directWithSelf],
    [500, ErrorCodes.internalError],
  ])(
    "a %s %s shows the plain failure, keeps the chips and enables the buttons",
    async (status, code) => {
      const user = userEvent.setup();
      fake.openDirect.mockRejectedValue(http(status, code));
      render(<Host />);
      await user.click(row(1));
      await user.click(start());
      expect(
        await screen.findByText("That did not work. Try again."),
      ).toHaveAttribute("role", "alert");
      expect(
        screen.getByRole("button", { name: "Remove Person 001" }),
      ).toBeInTheDocument();
      expect(start()).toBeEnabled();
    },
  );

  test("seven chips are chosen with no message; the eighth shows it and is not added", async () => {
    const user = userEvent.setup();
    fake.people = [fake.people[0]!, ...makePeople(9)];
    render(<Host />);
    for (let n = 1; n <= 7; n++) {
      await user.click(
        screen.getByRole("button", { name: new RegExp(`Person 00${n}$`) }),
      );
    }
    expect(screen.queryByText("Up to 8 people, counting you")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Person 008$/ }));
    expect(
      screen.getByText("Up to 8 people, counting you"),
    ).toBeInTheDocument();
    await user.click(start());
    expect(fake.openDirect.mock.calls[0]![0]).toHaveLength(7);
  });

  test("with no one chosen every close request closes at once", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("with people chosen Cancel asks, Keep editing stays, Discard closes; the question names New message", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await user.click(row(1));
    await user.click(row(2));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const ask = await screen.findByRole("dialog", {
      name: "Discard what you typed?",
    });
    expect(ask).toHaveTextContent("New message");
    await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Discard what you typed?" }),
      ).getByRole("button", {
        name: "Discard",
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("with people chosen Escape asks and the typed search does not count as content", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await user.type(screen.getByRole("searchbox"), "Per");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("an outside press does nothing with a person chosen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await user.click(row(1));
    const scrim = dialog().parentElement!;
    await user.pointer([{ keys: "[MouseLeft]", target: scrim }]);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("the state starts empty at every opening", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(row(1));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Discard what you typed?" }),
      ).getByRole("button", {
        name: "Discard",
      }),
    );
    await user.click(screen.getByRole("button", { name: "opener" }));
    expect(
      screen.queryByRole("button", { name: "Remove Person 001" }),
    ).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  test("Tab goes from the input through the rows and the footer; Shift+Tab reaches the chip's remove button; Space and Enter press a row (R25)", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(row(1)); // a chip now exists
    const rows = () => Array.from(dialog().querySelectorAll(".prow"));
    const input = screen.getByRole("searchbox");
    input.focus();
    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Remove Person 001" }),
    ).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    for (let n = 1; n <= 5; n++) {
      await user.tab();
      expect(rows()[n - 1]).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(start()).toHaveFocus();
    // Space and Enter press a row.
    (rows()[1] as HTMLElement).focus();
    await user.keyboard(" ");
    expect(rows()[1]).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Enter}");
    expect(rows()[1]).toHaveAttribute("aria-pressed", "false");
  });
});
