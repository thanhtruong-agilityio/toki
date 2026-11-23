// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@toki/client-core";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NoAccessProvider } from "../../../src/conversation/membership/noAccess";
import { RemoveMemberDialog } from "../../../src/conversation/membership/RemoveMemberDialog";
import { useRemoveMember } from "../../../src/conversation/membership/useRemoveMember";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { fake, resetFake } from "./fakeDeps";

vi.mock("../../../src/conversation/membership/deps", async () =>
  (await import("./fakeDeps")).fakeDepsModule(),
);

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code } as never);

function Host({
  name = "Lan Anh",
  isPrivate = false,
  onRemoved,
  onNoAccess,
}: {
  name?: string;
  isPrivate?: boolean;
  onRemoved?: () => void;
  onNoAccess?: () => void;
}) {
  const remove = useRemoveMember();
  const ref = useRef<HTMLButtonElement>(null);
  const [n, setN] = useState(0);
  return (
    <NoAccessProvider onNoAccess={onNoAccess ?? (() => {})}>
      <button
        ref={ref}
        type="button"
        onClick={() =>
          remove.ask(
            { id: "p9", displayName: name } as never,
            ref.current as HTMLElement,
          )
        }
      >
        ask {n}
      </button>
      <button type="button" onClick={() => setN(n + 1)}>
        other
      </button>
      <RemoveMemberDialog
        conversationId="c1"
        channel="design"
        isPrivate={isPrivate}
        target={remove.target}
        onClose={remove.close}
        onRemoved={onRemoved ?? (() => {})}
      />
    </NoAccessProvider>
  );
}

async function open(props: Parameters<typeof Host>[0] = {}) {
  const user = userEvent.setup();
  render(
    <Providers>
      <Host {...props} />
    </Providers>,
  );
  await user.click(screen.getByRole("button", { name: /^ask/ }));
  return { user };
}

const dlg = () => screen.getByRole("dialog", { name: "Remove this person?" });
const confirm = () => within(dlg()).getByRole("button", { name: "Remove" });
const closed = () =>
  waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Remove this person?" }),
    ).toBeNull(),
  );

describe("RemoveMemberDialog (R11)", () => {
  test("the confirmation names the person, also a two-letter name", async () => {
    await open({ name: "An" });
    expect(dlg().querySelector("p.cfm-target strong")?.textContent).toBe("An");
  });

  test("one paragraph holds both sentences, and it differs for a public and a private channel", async () => {
    await open();
    const text = dlg().querySelectorAll("p.cfm-text");
    expect(text).toHaveLength(1);
    expect(text[0]?.textContent).toBe(
      "The person named below will no longer be a member of #design. This channel is public, so the person can join again from Browse channels.",
    );
  });

  test("a private channel says a member will have to add the person back", async () => {
    await open({ isPrivate: true });
    expect(dlg().querySelector("p.cfm-text")?.textContent).toBe(
      "The person named below will no longer be a member of #design. This channel is private, so a member will have to add the person back.",
    );
  });

  test("Cancel changes nothing, sends nothing and returns focus to the pressed button", async () => {
    const onRemoved = vi.fn();
    const { user } = await open({ onRemoved });
    await user.click(within(dlg()).getByRole("button", { name: "Cancel" }));
    await closed();
    expect(fake.removeMember).not.toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /^ask/ }),
      ),
    );
  });

  test("Esc closes it and changes nothing", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    await closed();
    expect(fake.removeMember).not.toHaveBeenCalled();
  });
});

describe("RemoveMemberDialog, request (R12)", () => {
  test("a double confirm sends one request; success closes, runs onRemoved, shows no Undo", async () => {
    let release: (v: unknown) => void = () => {};
    fake.removeMember.mockReturnValue(new Promise((r) => (release = r)));
    const onRemoved = vi.fn();
    const { user } = await open({ onRemoved });
    await user.dblClick(confirm());
    expect(fake.removeMember).toHaveBeenCalledTimes(1);
    expect(fake.removeMember).toHaveBeenCalledWith("c1", "p9");
    expect(dlg()).toBeTruthy();
    await act(async () => release({ changed: true }));
    await closed();
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Undo")).toBeNull();
  });

  test("changed: false ends the same way", async () => {
    fake.removeMember.mockResolvedValue({ changed: false });
    const onRemoved = vi.fn();
    const { user } = await open({ onRemoved });
    await user.click(confirm());
    await closed();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  test("offline sends nothing and the dialog stays open", async () => {
    setConnectionCheck(() => false);
    const { user } = await open();
    await user.click(confirm());
    expect(fake.removeMember).not.toHaveBeenCalled();
    expect(dlg()).toBeTruthy();
  });
});

describe("RemoveMemberDialog, errors (R13)", () => {
  test("409 closes, runs onRemoved (reload) and shows one toast", async () => {
    fake.removeMember.mockRejectedValue(http(409, "channel_is_general"));
    const onRemoved = vi.fn();
    const { user } = await open({ onRemoved });
    await user.click(confirm());
    await closed();
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
  });

  test.each([403, 404])(
    "%i reaches the panel's no-access page and closes",
    async (status) => {
      fake.removeMember.mockRejectedValue(http(status, "forbidden"));
      const onNoAccess = vi.fn();
      const onRemoved = vi.fn();
      const { user } = await open({ onNoAccess, onRemoved });
      await user.click(confirm());
      await closed();
      expect(onNoAccess).toHaveBeenCalledTimes(1);
      expect(onRemoved).not.toHaveBeenCalled();
    },
  );

  test("a 500 keeps the dialog open, enables the buttons and shows the toast", async () => {
    fake.removeMember.mockRejectedValue(http(500, "internal"));
    const onRemoved = vi.fn();
    const { user } = await open({ onRemoved });
    await user.click(confirm());
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
    expect(dlg()).toBeTruthy();
    expect(confirm().hasAttribute("disabled")).toBe(false);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  test("a timeout behaves like a 500", async () => {
    fake.removeMember.mockRejectedValue(new ApiError({ kind: "timeout" }));
    const { user } = await open();
    await user.click(confirm());
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
    expect(dlg()).toBeTruthy();
  });
});
