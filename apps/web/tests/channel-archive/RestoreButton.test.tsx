// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RestoreButton } from "../../src/channel-archive/RestoreButton";
import { setConnectionCheck } from "../../src/patterns/online";
import {
  detail,
  http,
  summary,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { mountConversation } from "../support/conversation-mount";
import { channel, workspaceBody } from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;
const onChanged = vi.fn();
const FAILED = "That did not work. Try again.";

async function setup(role: "member" | "admin" = "admin") {
  onChanged.mockReset();
  const body = workspaceBody([channel("gen", "general", { isGeneral: true })]);
  body.user = { ...body.user, role };
  h = useFakeApi(body, {
    details: [detail("a1", "design", { archived: true, isMember: false })],
  });
  await h.loadNow();
}

type Row = ReturnType<typeof summary>;
const row = (over: Partial<Row> = {}) =>
  ({
    ...summary("a1", "design", { archived: true, isMember: false }),
    ...over,
  }) as never;

async function show(c: never = row()) {
  await mountConversation(
    () => <RestoreButton channel={c} onChanged={onChanged} />,
    { path: "/c/a1" },
  );
  await flush();
}

const button = () =>
  screen.queryByRole("button", {
    name: "Restore #design",
  }) as HTMLButtonElement | null;
const dialog = () => document.querySelector(".cfm") as HTMLElement | null;
const flush = () => act(async () => {});
const confirm = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await flush();
};

beforeEach(() => setConnectionCheck(null));
afterEach(() => setConnectionCheck(null));

describe("who is offered Restore (R18)", () => {
  test.each([
    [
      "an Admin who is not a member of an archived public channel",
      "admin",
      {},
      true,
    ],
    [
      "an Admin member of an archived private channel",
      "admin",
      { isPrivate: true, isMember: true },
      true,
    ],
    ["a Member", "member", {}, false],
    ["an active channel", "admin", { archived: false }, false],
    ["#general", "admin", { isGeneral: true }, false],
  ] as const)("%s -> %s", async (_name, role, over, shown) => {
    await setup(role);
    await show(row(over as Partial<Row>));
    if (shown) expect(button()).toBeInTheDocument();
    else expect(button()).toBeNull();
  });

  test("it is a small Button with the text Restore and the channel's name in its label", async () => {
    await setup();
    await show();
    expect(button()).toHaveTextContent("Restore");
    expect(button()!.className).toContain("sm");
  });
});

describe("the press (R19)", () => {
  beforeEach(() => setup());

  test("opens the confirmation and calls nothing yet", async () => {
    await show();
    fireEvent.click(button()!);
    await flush();
    expect(h.api.channels.restore).not.toHaveBeenCalled();
    expect(dialog()).toHaveTextContent("Restore this channel?");
    expect(dialog()!.querySelector(".cfm-target strong")).toHaveTextContent(
      "#design",
    );
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(
      "It will come back to the list of every member of the channel.",
    );
    expect(screen.getByRole("button", { name: "Restore" }).className).toContain(
      "primary",
    );
  });

  test.each([
    [
      "Cancel",
      () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    ["Esc", () => fireEvent.keyDown(document, { key: "Escape" })],
  ])("%s changes nothing and returns focus to the button", async (_n, act_) => {
    await show();
    fireEvent.click(button()!);
    await flush();
    act(() => act_());
    await flush();
    expect(dialog()).toBeNull();
    expect(h.api.channels.restore).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button());
  });

  test("offline: nothing is sent and the dialog stays", async () => {
    await show();
    fireEvent.click(button()!);
    await flush();
    setConnectionCheck(() => false);
    await confirm();
    expect(h.api.channels.restore).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  test("Confirm: one call (a double press sends one), one plain toast with no Undo, onChanged, the store holds the channel", async () => {
    await show();
    fireEvent.click(button()!);
    await flush();
    // The refresh that follows brings the channel in the list; the dialog is busy until it ends.
    h.answer(
      workspaceBody([
        channel("gen", "general", { isGeneral: true }),
        channel("a1", "design"),
      ]),
    );
    const release = h.holdNext();
    const go = screen.getByRole("button", { name: "Restore" });
    fireEvent.click(go);
    fireEvent.click(go);
    await flush();
    expect(h.api.channels.restore).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
    await flush();
    expect(screen.getByText("Restored #design")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(onChanged).toHaveBeenCalledOnce();
    expect(h.store.hasConversation("a1")).toBe(true);
    expect(dialog()).toBeNull();
  });

  test.each([[409], [410], [403], [404]])(
    "%s closes the dialog, one failure toast, onChanged",
    async (status) => {
      await show();
      fireEvent.click(button()!);
      await flush();
      h.api.channels.restore.mockRejectedValueOnce(http(status));
      await confirm();
      expect(dialog()).toBeNull();
      expect(screen.getAllByText(FAILED)).toHaveLength(1);
      expect(onChanged).toHaveBeenCalledOnce();
    },
  );

  test("a 500 keeps the dialog open with the failure toast", async () => {
    await show();
    fireEvent.click(button()!);
    await flush();
    h.api.channels.restore.mockRejectedValueOnce(http(500));
    await confirm();
    expect(dialog()).not.toBeNull();
    expect(screen.getAllByText(FAILED)).toHaveLength(1);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
