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
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { InviteDialog } from "../../src/admin/InviteDialog";
import { useKeyPerId } from "../../src/admin/useKeyPerId";
import { setConnectionCheck } from "../../src/patterns/online";
import { toastText } from "../support/adminHarness";
import {
  createFakeAdminServer,
  failWith,
  hold,
  invitation,
  person,
  type FakeAdminServer,
  type FakeAdminServerOptions,
} from "../support/fakeAdminServer";
import { Providers } from "../support/providers";

afterEach(() => {
  setConnectionCheck(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Host({ reload }: { reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const keys = useKeyPerId();
  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)}>
        Invite members
      </button>
      <InviteDialog
        open={open}
        onClose={() => setOpen(false)}
        reload={reload}
        keys={keys}
        returnFocusRef={opener}
      />
    </>
  );
}

async function setup(options: FakeAdminServerOptions = {}) {
  const server = createFakeAdminServer({
    members: [person({ n: 1, email: "lan@example.com" }), invitation({ n: 1 })],
    ...options,
  }).install();
  const reload = vi.fn(async () => undefined);
  const forbidden = vi.fn();
  render(
    <Providers>
      <AdminForbiddenContext.Provider value={forbidden}>
        <Host reload={reload} />
      </AdminForbiddenContext.Provider>
    </Providers>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Invite members" }));
  return { server, reload, forbidden };
}

const box = () => screen.getByRole("dialog", { name: "Invite members" });
const field = () =>
  within(box()).getByRole("textbox", { name: "Email addresses" });
const send = () =>
  within(box()).getByRole("button", { name: "Send invitations" });
const type = (text: string) =>
  fireEvent.change(field(), { target: { value: text } });
const posts = (server: FakeAdminServer) =>
  server.calls.filter((c) => c.method === "POST");
const inviteCalls = (server: FakeAdminServer) =>
  posts(server).filter((c) => c.path === "/invitations");
const keyOf = (server: FakeAdminServer, index: number) =>
  inviteCalls(server)[index]?.headers["idempotency-key"];

const mailLine = (n: number) => `a${n}@example.com`;
const many = (count: number) =>
  Array.from({ length: count }, (_, i) => mailLine(i + 1)).join(", ");

describe("the form (R21)", () => {
  it("opens with the field in focus, the role Member chosen first and Send disabled", async () => {
    await setup();
    expect(field()).toHaveFocus();
    const select = within(box()).getByRole("combobox", { name: "Role" });
    expect(select).toHaveValue("member");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Member", "Admin"]);
    expect(send()).toBeDisabled();
    expect(
      within(box()).getByText("Separate addresses with commas or new lines."),
    ).toBeTruthy();
  });

  it("returns the focus to the button that opened it when it closes", async () => {
    await setup();
    await userEvent.click(within(box()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Invite members" }),
    ).toHaveFocus();
  });
});

describe("validation (R22)", () => {
  it.each([
    ["commas", "a@example.com,b@example.com"],
    ["line feeds", "a@example.com\nb@example.com"],
    ["carriage returns", "a@example.com\rb@example.com"],
    ["CRLF", "a@example.com\r\nb@example.com"],
  ])("splits at %s", async (_name, text) => {
    const { server } = await setup();
    type(text);
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(1));
    expect(inviteCalls(server)[0]?.body).toEqual({
      emails: ["a@example.com", "b@example.com"],
      role: "member",
    });
  });

  it("counts a repeated address once and sends the chosen role", async () => {
    const { server } = await setup();
    type("a@example.com, A@Example.com, b@example.com");
    await userEvent.selectOptions(
      within(box()).getByRole("combobox", { name: "Role" }),
      "admin",
    );
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(1));
    expect(inviteCalls(server)[0]?.body).toEqual({
      emails: ["a@example.com", "b@example.com"],
      role: "admin",
    });
  });

  it("shows one invalid piece as a message under the field, never a toast, and keeps Send disabled until it is fixed", async () => {
    await setup();
    type("a@example.com, nope");
    expect(
      within(box()).getByText('"nope" is not a valid email address.'),
    ).toBeTruthy();
    expect(send()).toBeDisabled();
    expect(toastText()).toBe("");
    type("a@example.com, nope@example.com");
    expect(
      within(box()).queryByText(/is not a valid email address/),
    ).toBeNull();
    expect(send()).toBeEnabled();
  });

  it("sends 50 addresses and refuses 51 with its message and Send disabled", async () => {
    const { server } = await setup();
    type(many(51));
    expect(
      within(box()).getByText("Send at most 50 addresses at a time."),
    ).toBeTruthy();
    expect(send()).toBeDisabled();
    type(many(50));
    expect(send()).toBeEnabled();
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(1));
    expect(
      (inviteCalls(server)[0]?.body as { emails: string[] }).emails,
    ).toHaveLength(50);
  });
});

describe("closing a form with content (R21)", () => {
  it("closes at once when there is no text, also when only the role was changed", async () => {
    await setup();
    await userEvent.selectOptions(
      within(box()).getByRole("combobox", { name: "Role" }),
      "admin",
    );
    await userEvent.click(
      within(box()).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("dialog", { name: "Invite members" })).toBeNull();
    expect(screen.queryByText("Discard what you typed?")).toBeNull();
  });

  it("asks to discard on Cancel and on the close button when there is text, and keeps the form on Keep editing", async () => {
    await setup();
    type("a@example.com");
    await userEvent.click(
      within(box()).getByRole("button", { name: "Cancel" }),
    );
    expect(await screen.findByText("Discard what you typed?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(field()).toHaveValue("a@example.com");
    await userEvent.click(within(box()).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Discard what you typed?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog", { name: "Invite members" })).toBeNull();
  });

  it("an outside press does nothing when there is text", async () => {
    await setup();
    type("a@example.com");
    await userEvent.click(box().parentElement as HTMLElement);
    expect(field()).toHaveValue("a@example.com");
    expect(screen.queryByText("Discard what you typed?")).toBeNull();
  });

  it("forgets what was typed after it was discarded", async () => {
    await setup();
    type("a@example.com");
    await userEvent.click(
      within(box()).getByRole("button", { name: "Cancel" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Invite members" }),
    );
    expect(field()).toHaveValue("");
  });
});

describe("sending (R22)", () => {
  it("disables both buttons while it runs and ignores Esc and the close button", async () => {
    const gate = hold();
    const { server } = await setup({
      gate: (call) => (call.method === "POST" ? gate.promise : undefined),
    });
    type("a@example.com");
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(1));
    expect(send()).toBeDisabled();
    expect(
      within(box()).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Invite members" })).toBeTruthy();
    expect(screen.queryByText("Discard what you typed?")).toBeNull();
    gate.release();
    await within(box()).findByRole("list", { name: "Results" });
  });

  it("ignores Esc while it runs even when the form had no text to guard", async () => {
    const gate = hold();
    await setup({
      gate: (call) => (call.method === "POST" ? gate.promise : undefined),
    });
    type("a@example.com");
    await userEvent.click(send());
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Invite members" })).toBeTruthy();
    gate.release();
  });

  it("waits for a slow but healthy batch of 50 (20 s) and shows the results, not a failure", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server = createFakeAdminServer({
      members: [person({ n: 1 })],
      gate: (call) =>
        call.method === "POST"
          ? new Promise<void>((resolve) => setTimeout(resolve, 20_000))
          : undefined,
    }).install();
    render(
      <Providers>
        <AdminForbiddenContext.Provider value={() => undefined}>
          <Host reload={async () => undefined} />
        </AdminForbiddenContext.Provider>
      </Providers>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    type(many(50));
    fireEvent.click(send());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_001);
    });
    expect(
      await within(box()).findByRole("list", { name: "Results" }),
    ).toBeTruthy();
    expect(within(box()).getAllByRole("listitem")).toHaveLength(50);
    expect(posts(server)).toHaveLength(1);
  });

  it("offline: Send is blocked with the explanation and sends nothing", async () => {
    const { server } = await setup();
    type("a@example.com");
    setConnectionCheck(() => false);
    await userEvent.click(send());
    expect(toastText()).toBe(
      "You are offline. Try again when the connection is back.",
    );
    expect(posts(server)).toHaveLength(0);
    expect(field()).toHaveValue("a@example.com");
  });
});

describe("what goes wrong (R22)", () => {
  const SEND_AGAIN_SAME_KEY = [
    [
      "a 500 with a request id",
      () => failWith(500, "internal_error", "req-1"),
      "That did not work. Try again.",
      "Error ID: req-1",
    ],
    [
      "a 500 without a request id",
      () => failWith(500, "internal_error"),
      "That did not work. Try again.",
      null,
    ],
    [
      "a network error",
      () => new TypeError("net"),
      "That did not work. Try again.",
      null,
    ],
    [
      "a 409 request_in_progress",
      () => failWith(409, "request_in_progress"),
      "Still sending. Try again in a moment.",
      null,
    ],
  ] as const;

  it.each(SEND_AGAIN_SAME_KEY)(
    "%s keeps the dialog and the form, shows the message under the field and keeps the key",
    async (_name, answer, message, errorId) => {
      let fail = true;
      const { server } = await setup({
        fail: (call) => (call.method === "POST" && fail ? answer() : undefined),
      });
      type("a@example.com");
      await userEvent.click(send());
      expect(await within(box()).findByText(message)).toBeTruthy();
      if (errorId) expect(within(box()).getByText(errorId)).toBeTruthy();
      expect(toastText()).toBe("");
      expect(field()).toHaveValue("a@example.com");
      expect(send()).toBeEnabled();
      fail = false;
      await userEvent.click(send());
      await within(box()).findByRole("list", { name: "Results" });
      expect(inviteCalls(server)).toHaveLength(2);
      expect(keyOf(server, 1)).toBe(keyOf(server, 0));
    },
  );

  it("a 409 idempotency_key_reused and any other 400 say it did not work, and the key is replaced", async () => {
    let answer = () => failWith(409, "idempotency_key_reused");
    const { server } = await setup({
      fail: (call) => (call.method === "POST" && answer ? answer() : undefined),
    });
    type("a@example.com");
    await userEvent.click(send());
    expect(
      await within(box()).findByText("That did not work. Try again."),
    ).toBeTruthy();
    answer = () => failWith(400, "validation_failed");
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(2));
    expect(keyOf(server, 1)).not.toBe(keyOf(server, 0));
    expect(
      within(box()).getByText("That did not work. Try again."),
    ).toBeTruthy();
  });

  it("a 400 batch_too_large shows the too-many message under the field", async () => {
    await setup({
      fail: (call) =>
        call.method === "POST" ? failWith(400, "batch_too_large") : undefined,
    });
    type("a@example.com");
    await userEvent.click(send());
    expect(
      await within(box()).findByText("Send at most 50 addresses at a time."),
    ).toBeTruthy();
  });

  it("a 403 tells the page", async () => {
    const { forbidden } = await setup({
      fail: (call) =>
        call.method === "POST" ? failWith(403, "forbidden") : undefined,
    });
    type("a@example.com");
    await userEvent.click(send());
    await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
  });

  it("replaces the key after an edit of the text or of the role, and after a 200", async () => {
    let fail = true;
    const { server } = await setup({
      fail: (call) =>
        call.method === "POST" && fail
          ? failWith(500, "internal_error")
          : undefined,
    });
    type("a@example.com");
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(1));
    // The text changes: a new key.
    type("a@example.com, b@example.com");
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(2));
    expect(keyOf(server, 1)).not.toBe(keyOf(server, 0));
    // The role changes: a new key.
    await userEvent.selectOptions(
      within(box()).getByRole("combobox", { name: "Role" }),
      "admin",
    );
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(3));
    expect(keyOf(server, 2)).not.toBe(keyOf(server, 1));
    // Nothing changes: the same key. After a 200 the next batch has a new one.
    fail = false;
    await userEvent.click(send());
    await within(box()).findByRole("list", { name: "Results" });
    expect(keyOf(server, 3)).toBe(keyOf(server, 2));
    await userEvent.click(within(box()).getByRole("button", { name: "Done" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Invite members" }),
    );
    type("c@example.com");
    await userEvent.click(send());
    await waitFor(() => expect(inviteCalls(server)).toHaveLength(5));
    expect(keyOf(server, 4)).not.toBe(keyOf(server, 3));
  });
});

describe("the result step (R23)", () => {
  it("shows each address its own result for a batch of ten where seven mails did not go out", async () => {
    const { server, reload } = await setup({
      inviteResult: (email) =>
        Number(/a(\d+)@/.exec(email)?.[1]) <= 3 ? "invited" : "mail_not_sent",
    });
    type(many(10));
    await userEvent.click(send());
    const list = await within(box()).findByRole("list", { name: "Results" });
    const lines = within(list).getAllByRole("listitem");
    expect(lines).toHaveLength(10);
    expect(lines.filter((l) => within(l).queryByText("Invited"))).toHaveLength(
      3,
    );
    expect(
      lines.filter((l) => within(l).queryByText("Mail not sent")),
    ).toHaveLength(7);
    expect(
      within(list).getAllByRole("button", { name: "Resend" }),
    ).toHaveLength(7);
    // The invitations that were sent stay: the table behind was reloaded already, not at Done.
    expect(reload).toHaveBeenCalledTimes(1);
    expect(inviteCalls(server)).toHaveLength(1);
    // The form is gone and the footer is one Done button.
    expect(within(box()).queryByRole("textbox")).toBeNull();
    expect(
      within(box())
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toContain("Done");
    expect(
      within(box()).queryByRole("button", { name: "Send invitations" }),
    ).toBeNull();
  });

  it("reads one result of each kind in the server's order", async () => {
    await setup({
      members: [
        person({ n: 1, email: "lan@example.com" }),
        invitation({ n: 1 }),
      ],
      inviteResult: (email) =>
        email === "nomail@example.com" ? "mail_not_sent" : "invited",
    });
    type(
      "new@example.com, nomail@example.com, lan@example.com, invitee001@example.com, bad@example.com",
    );
    await userEvent.click(send());
    const list = await within(box()).findByRole("list", { name: "Results" });
    const lines = within(list)
      .getAllByRole("listitem")
      .map((l) => l.textContent);
    expect(lines).toEqual([
      expect.stringMatching(/^new@example\.com.*Invited$/),
      expect.stringMatching(/^nomail@example\.com.*Mail not sent/),
      expect.stringMatching(/^lan@example\.com.*Already a member$/),
      expect.stringMatching(/^invitee001@example\.com.*Already invited$/),
      expect.stringMatching(/^bad@example\.com.*Not a valid address$/),
    ]);
  });

  it("Resend inside the result step sends the invitation's key and shows the new result on the line", async () => {
    let result: "invited" | "mail_not_sent" = "mail_not_sent";
    const { server } = await setup({
      inviteResult: () => "mail_not_sent",
      resendResult: () => result,
    });
    type("new@example.com");
    await userEvent.click(send());
    const list = await within(box()).findByRole("list", { name: "Results" });
    result = "invited";
    await userEvent.click(within(list).getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(within(list).getByText("Invited")).toBeTruthy());
    expect(within(list).queryByRole("button", { name: "Resend" })).toBeNull();
    const resend = posts(server).find((c) => /\/resend$/.test(c.path));
    expect(resend?.headers["idempotency-key"]).toHaveLength(36);
  });

  it("Esc and the close button also close the result step without asking", async () => {
    await setup();
    type("new@example.com");
    await userEvent.click(send());
    await within(box()).findByRole("list", { name: "Results" });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Invite members" })).toBeNull();
    expect(screen.queryByText("Discard what you typed?")).toBeNull();
  });

  it("Done closes the dialog without asking, although the typed text is still there", async () => {
    await setup();
    type("new@example.com");
    await userEvent.click(send());
    await within(box()).findByRole("list", { name: "Results" });
    await userEvent.click(within(box()).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Discard what you typed?")).toBeNull();
  });
});
