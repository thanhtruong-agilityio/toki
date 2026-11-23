// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { setConnectionCheck } from "../../src/patterns/online";
import { directory, renderMembers, toastText } from "../support/adminHarness";
import {
  failWith,
  hold,
  invitation,
  person,
  type FakeAdminServer,
  type FakeCall,
} from "../support/fakeAdminServer";

afterEach(() => setConnectionCheck(null));

const posts = (server: FakeAdminServer) =>
  server.calls.filter((c) => c.method === "POST");
const lists = (server: FakeAdminServer) =>
  server.calls.filter((c) => c.method === "GET" && c.path === "/members");
const heading = () =>
  screen.getByRole("heading", { level: 2, name: "Members" });
const dialog = (name: string) => screen.getByRole("dialog", { name });

async function chooseFromMenu(person: string, item: RegExp | string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Actions for ${person}` }),
  );
  await userEvent.click(
    within(screen.getByRole("menu")).getByRole("menuitem", { name: item }),
  );
}

const confirmButton = (title: string, name: string) =>
  within(dialog(title)).getByRole("button", { name });

describe("Revoke (R18, R19)", () => {
  const open = async () => {
    const view = renderMembers({
      members: [invitation({ n: 1 }), person({ n: 1 })],
    });
    const row = (
      await screen.findByText("invitee001@example.com", { selector: "b" })
    ).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Revoke" }));
    return view;
  };

  it("asks a confirmation that names the address and sends nothing until it is confirmed", async () => {
    const { server } = await open();
    const box = dialog("Revoke this invitation?");
    expect(box).toHaveTextContent("invitee001@example.com");
    expect(box).toHaveTextContent("The invitation to");
    expect(posts(server)).toHaveLength(0);
  });

  it("Cancel, Esc and an outside press change nothing and send nothing", async () => {
    const { server } = await open();
    await userEvent.click(confirmButton("Revoke this invitation?", "Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();

    const row = screen
      .getByText("invitee001@example.com", { selector: "b" })
      .closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Revoke" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(within(row).getByRole("button", { name: "Revoke" }));
    await userEvent.click(
      dialog("Revoke this invitation?").parentElement as HTMLElement,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(posts(server)).toHaveLength(0);
    // The row is still there.
    expect(
      screen.getByText("invitee001@example.com", { selector: "b" }),
    ).toBeTruthy();
  });

  it("confirms with one request, ignores a second press while it runs, then closes, reloads, says so and focuses the heading", async () => {
    const gate = hold();
    const { server } = renderMembers({
      members: [invitation({ n: 1 }), person({ n: 1 })],
      gate: (call) => (call.method === "POST" ? gate.promise : undefined),
    });
    const row = (
      await screen.findByText("invitee001@example.com", { selector: "b" })
    ).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Revoke" }));
    const confirm = confirmButton("Revoke this invitation?", "Revoke");
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(posts(server)).toHaveLength(1);
    expect(posts(server)[0]).toMatchObject({
      path: "/invitations/inv-001/revoke",
    });
    gate.release();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(toastText()).toContain("Invitation revoked"));
    await waitFor(() => expect(lists(server)).toHaveLength(2));
    // The row has gone, so the focus goes to the heading of the members section (R19).
    await waitFor(() =>
      expect(
        screen.queryByText("invitee001@example.com", { selector: "b" }),
      ).toBeNull(),
    );
    await waitFor(() => expect(heading()).toHaveFocus());
  });
});

describe("Deactivate, Change role, Reactivate (R18, R19)", () => {
  it("Deactivate names the person, sends one request and returns the focus to the menu button", async () => {
    const { server } = renderMembers();
    await chooseFromMenu("Minh", "Deactivate");
    const box = dialog("Deactivate this person?");
    expect(box).toHaveTextContent("Minh will be signed out everywhere");
    expect(box.querySelector(".cfm-target")).toHaveTextContent("Minh");
    await userEvent.click(
      confirmButton("Deactivate this person?", "Deactivate"),
    );
    await waitFor(() => expect(toastText()).toContain("Deactivated"));
    expect(posts(server)).toHaveLength(1);
    expect(posts(server)[0]).toMatchObject({
      path: "/members/u-002/deactivate",
    });
    await waitFor(() => expect(lists(server)).toHaveLength(2));
    // The reload gives the row its new status and the focus is back on its menu button.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Actions for Minh" }),
      ).toHaveFocus(),
    );
    const row = screen.getByText("Minh", { selector: "b" }).closest("tr")!;
    expect(within(row).getByText("Deactivated")).toBeTruthy();
  });

  it("Change role names the new role and sends it", async () => {
    const { server } = renderMembers();
    await chooseFromMenu("Minh", "Admin");
    const box = dialog("Change role?");
    expect(box).toHaveTextContent("New role: Admin.");
    expect(box.querySelector(".cfm-target")).toHaveTextContent("Minh");
    await userEvent.click(confirmButton("Change role?", "Change role"));
    await waitFor(() => expect(toastText()).toContain("Role changed"));
    expect(posts(server)[0]).toMatchObject({
      path: "/members/u-002/role",
      body: { role: "admin" },
    });
  });

  it("Change role to Member says what the person can no longer do", async () => {
    renderMembers();
    await chooseFromMenu("Ann", "Member");
    expect(dialog("Change role?")).toHaveTextContent("New role: Member.");
  });

  it("Reactivate sends one request and says so", async () => {
    const { server } = renderMembers();
    await chooseFromMenu("Bo", "Reactivate");
    expect(dialog("Reactivate this person?")).toHaveTextContent(
      "Bo can sign in again",
    );
    await userEvent.click(
      confirmButton("Reactivate this person?", "Reactivate"),
    );
    await waitFor(() => expect(toastText()).toContain("Reactivated"));
    expect(posts(server)[0]).toMatchObject({
      path: "/members/u-004/reactivate",
    });
  });

  it("Esc, Cancel and an outside press send nothing", async () => {
    const { server } = renderMembers();
    await chooseFromMenu("Minh", "Deactivate");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await chooseFromMenu("Minh", "Deactivate");
    await userEvent.click(confirmButton("Deactivate this person?", "Cancel"));
    await chooseFromMenu("Minh", "Deactivate");
    await userEvent.click(
      dialog("Deactivate this person?").parentElement as HTMLElement,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(posts(server)).toHaveLength(0);
  });

  it("offline: the dialog stays open, the toast explains and nothing is sent, with one message", async () => {
    const { server } = renderMembers();
    await chooseFromMenu("Minh", "Deactivate");
    setConnectionCheck(() => false);
    await userEvent.click(
      confirmButton("Deactivate this person?", "Deactivate"),
    );
    expect(toastText()).toBe(
      "You are offline. Try again when the connection is back.",
    );
    expect(
      screen.getByRole("dialog", { name: "Deactivate this person?" }),
    ).toBeTruthy();
    expect(posts(server)).toHaveLength(0);
  });
});

// What the page does with each answer of a request (R19), checked on Deactivate.
type Case = {
  name: string;
  answer: (call: FakeCall) => Response | Error | undefined;
  // "closed": the dialog closes, the list is reloaded and the toast says the page was stale.
  // "open": the dialog stays, the button is enabled again and the toast says what failed.
  result: "closed" | "open" | "forbidden" | "session";
  toast?: string;
};

const STALE = "This page was out of date. It has been refreshed.";
const FAILED = "That did not work. Try again.";
const onPost = (answer: () => Response | Error) => (call: FakeCall) =>
  call.method === "POST" ? answer() : undefined;

const CASES: Case[] = [
  {
    name: "409 last_admin",
    answer: onPost(() => failWith(409, "last_admin")),
    result: "closed",
    toast: STALE,
  },
  {
    name: "409 self_target",
    answer: onPost(() => failWith(409, "self_target")),
    result: "closed",
    toast: STALE,
  },
  {
    name: "409 invitation_used",
    answer: onPost(() => failWith(409, "invitation_used")),
    result: "closed",
    toast: STALE,
  },
  {
    name: "409 invitation_revoked",
    answer: onPost(() => failWith(409, "invitation_revoked")),
    result: "closed",
    toast: STALE,
  },
  {
    name: "404 not_found",
    answer: onPost(() => failWith(404, "not_found")),
    result: "closed",
    toast: STALE,
  },
  {
    name: "403",
    answer: onPost(() => failWith(403, "forbidden")),
    result: "forbidden",
  },
  {
    name: "401 that is not a session code",
    answer: onPost(() => failWith(401, "bad_token")),
    result: "session",
  },
  {
    name: "500 with a request id",
    answer: onPost(() => failWith(500, "internal_error", "req-1")),
    result: "open",
    toast: `${FAILED} Error ID: req-1`,
  },
  {
    name: "500 without a request id",
    answer: onPost(() => failWith(500, "internal_error")),
    result: "open",
    toast: FAILED,
  },
  {
    name: "a network error",
    answer: onPost(() => new TypeError("net")),
    result: "open",
    toast: FAILED,
  },
  {
    name: "409 request_in_progress",
    answer: onPost(() => failWith(409, "request_in_progress")),
    result: "open",
    toast: "Still sending. Try again in a moment.",
  },
  {
    name: "409 idempotency_key_reused",
    answer: onPost(() => failWith(409, "idempotency_key_reused")),
    result: "open",
    toast: FAILED,
  },
  {
    name: "any other 409",
    answer: onPost(() => failWith(409, "conflict")),
    result: "open",
    toast: FAILED,
  },
  {
    name: "400",
    answer: onPost(() => failWith(400, "validation_failed")),
    result: "open",
    toast: FAILED,
  },
];

describe("each result of a request (R19)", () => {
  it.each(CASES)("$name", async ({ answer, result, toast }) => {
    const { server, forbidden } = renderMembers({
      members: directory(),
      fail: answer,
    });
    await chooseFromMenu("Minh", "Deactivate");
    await userEvent.click(
      confirmButton("Deactivate this person?", "Deactivate"),
    );
    // One request for one press, never repeated by itself.
    await waitFor(() => expect(posts(server)).toHaveLength(1));
    if (toast !== undefined)
      await waitFor(() => expect(toastText()).toBe(toast));

    if (result === "closed") {
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(lists(server)).toHaveLength(2));
      expect(forbidden).not.toHaveBeenCalled();
    } else if (result === "forbidden") {
      await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
      expect(toastText()).toBe("");
    } else {
      const box = dialog("Deactivate this person?");
      expect(box).toBeTruthy();
      await waitFor(() =>
        expect(
          within(box).getByRole("button", { name: "Deactivate" }),
        ).toBeEnabled(),
      );
      expect(forbidden).not.toHaveBeenCalled();
      if (result === "session") expect(toastText()).toBe("");
    }
    expect(posts(server)).toHaveLength(1);
  });
});

describe("Resend (R20)", () => {
  const resendOf = (address: string) =>
    within(
      screen.getByText(address, { selector: "b" }).closest("tr") as HTMLElement,
    ).getByRole("button", { name: "Resend" });
  const keys = (server: FakeAdminServer) =>
    posts(server).map((c) => c.headers["idempotency-key"]);

  it("asks no confirmation, sends one request with a key, says so and reloads", async () => {
    const { server } = renderMembers();
    await screen.findByRole("table");
    await userEvent.click(resendOf("invitee001@example.com"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(toastText()).toBe("Invitation sent to invitee001@example.com"),
    );
    expect(posts(server)).toHaveLength(1);
    expect(posts(server)[0]).toMatchObject({
      path: "/invitations/inv-001/resend",
    });
    expect(keys(server)[0]).toHaveLength(36);
    await waitFor(() => expect(lists(server)).toHaveLength(2));
  });

  it("says when the mail did not go out", async () => {
    renderMembers({
      members: directory(),
      resendResult: () => "mail_not_sent",
    });
    await screen.findByRole("table");
    await userEvent.click(resendOf("invitee001@example.com"));
    await waitFor(() =>
      expect(toastText()).toBe("Mail not sent to invitee001@example.com"),
    );
  });

  it("is disabled while it runs and two fast presses send one request", async () => {
    const gate = hold();
    const { server } = renderMembers({
      members: directory(),
      gate: (call) => (call.method === "POST" ? gate.promise : undefined),
    });
    await screen.findByRole("table");
    const button = resendOf("invitee001@example.com");
    await userEvent.click(button);
    await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(posts(server)).toHaveLength(1);
    gate.release();
    await waitFor(() =>
      expect(resendOf("invitee001@example.com")).toBeEnabled(),
    );
  });

  it("sends the same key after an answer that may have been lost, a new one after a success, and each invitation has its own", async () => {
    let fail: (() => Response | Error) | null = () =>
      failWith(500, "internal_error");
    const { server } = renderMembers({
      members: directory(),
      fail: (call) => (call.method === "POST" && fail ? fail() : undefined),
    });
    await screen.findByRole("table");
    const first = "invitee001@example.com";
    const second = "invitee002@example.com";

    await userEvent.click(resendOf(first));
    await waitFor(() => expect(toastText()).toContain("That did not work"));
    // A network error, then a timeout-like 409 in progress: the key stays.
    fail = () => new TypeError("net");
    await userEvent.click(resendOf(first));
    await waitFor(() => expect(posts(server)).toHaveLength(2));
    fail = () => failWith(409, "request_in_progress");
    await userEvent.click(resendOf(first));
    await waitFor(() =>
      expect(toastText()).toContain("Still sending. Try again in a moment."),
    );
    const [a, b, c] = keys(server);
    expect(b).toBe(a);
    expect(c).toBe(a);

    // Another invitation has its own key.
    fail = null;
    await userEvent.click(resendOf(second));
    await waitFor(() => expect(posts(server)).toHaveLength(4));
    expect(keys(server)[3]).not.toBe(a);

    // After a success the first invitation gets a new key.
    await userEvent.click(resendOf(first));
    await waitFor(() => expect(posts(server)).toHaveLength(5));
    expect(keys(server)[4]).toBe(a);
    await waitFor(() => expect(resendOf(first)).toBeEnabled());
    await userEvent.click(resendOf(first));
    await waitFor(() => expect(posts(server)).toHaveLength(6));
    expect(keys(server)[5]).not.toBe(a);
  });

  it("drops the key after 409 idempotency_key_reused", async () => {
    let fail = true;
    const { server } = renderMembers({
      members: directory(),
      fail: (call) =>
        call.method === "POST" && fail
          ? failWith(409, "idempotency_key_reused")
          : undefined,
    });
    await screen.findByRole("table");
    await userEvent.click(resendOf("invitee001@example.com"));
    await waitFor(() => expect(toastText()).toContain("That did not work"));
    fail = false;
    await userEvent.click(resendOf("invitee001@example.com"));
    await waitFor(() => expect(posts(server)).toHaveLength(2));
    const [a, b] = keys(server);
    expect(b).not.toBe(a);
  });

  it("offline: sends nothing and says why", async () => {
    const { server } = renderMembers();
    await screen.findByRole("table");
    setConnectionCheck(() => false);
    await userEvent.click(resendOf("invitee001@example.com"));
    expect(toastText()).toBe(
      "You are offline. Try again when the connection is back.",
    );
    expect(posts(server)).toHaveLength(0);
  });

  it("a 403 tells the page and a 404 reloads with the stale toast, without a dialog", async () => {
    let answer: () => Response = () => failWith(403, "forbidden");
    const { server, forbidden } = renderMembers({
      members: directory(),
      fail: (call) => (call.method === "POST" ? answer() : undefined),
    });
    await screen.findByRole("table");
    await userEvent.click(resendOf("invitee001@example.com"));
    await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
    answer = () => failWith(404, "invitation_not_found");
    await userEvent.click(resendOf("invitee001@example.com"));
    await waitFor(() => expect(toastText()).toBe(STALE));
    await waitFor(() => expect(lists(server)).toHaveLength(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
