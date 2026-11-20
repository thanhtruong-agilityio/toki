// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { markSignedIn } from "@toki/client-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { AdminPage } from "../../src/admin/AdminPage";
import { directory } from "../support/adminHarness";
import {
  createFakeAdminServer,
  manyChannels,
  type FakeAdminServerOptions,
} from "../support/fakeAdminServer";
import { installFakeIntersectionObserver } from "../support/fakeIntersection";
import { Providers } from "../support/providers";
import { user } from "../support/auth-harness";

// The button and its dialog are TOKI-098's: here a stand-in that calls `onCreated` with an id, as the
// dialog does, and that the page's list must answer by reloading.
vi.mock("../../src/features/create-channel/CreateChannelButton", () => ({
  CreateChannelButton: ({
    onCreated,
  }: {
    onCreated?: (id: string) => void;
  }) => (
    <button
      type="button"
      data-testid="create-channel-stand-in"
      onClick={() => onCreated?.("c-new")}
    >
      plus
    </button>
  ),
}));

vi.mock("../../src/admin/notices", () => ({
  AdminNotices: () => <p data-testid="notices">a notice</p>,
}));

beforeEach(() => {
  installFakeIntersectionObserver();
  markSignedIn({ ...user, id: "u-001", role: "admin" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(options: FakeAdminServerOptions = {}) {
  const server = createFakeAdminServer({
    members: directory(),
    channels: manyChannels(3),
    ...options,
  }).install();
  const forbidden = vi.fn();
  render(
    <Providers>
      <AdminForbiddenContext.Provider value={forbidden}>
        <AdminPage />
      </AdminForbiddenContext.Provider>
    </Providers>,
  );
  return { server, forbidden };
}

describe("the Admin page (TOKI-025 R1, R25, R27)", () => {
  it("has the title Admin, the notices above the members section, then the Channels section", async () => {
    setup();
    expect(
      screen.getByRole("heading", { level: 1, name: "Admin" }),
    ).toBeTruthy();
    await screen.findByRole("table", { name: "Members" });
    await screen.findByRole("table", { name: "Channels" });
    const notices = screen.getByTestId("notices");
    const members = screen.getByRole("heading", { level: 2, name: "Members" });
    const channels = screen.getByRole("heading", {
      level: 2,
      name: "Channels",
    });
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(notices, members)).toBe(true);
    expect(before(members, channels)).toBe(true);
  });

  it("puts the Invite members button in the title row, and it opens the dialog", async () => {
    setup();
    const button = screen.getByRole("button", { name: "Invite members" });
    expect(button.closest(".sechead")).toBeTruthy();
    await userEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Invite members" })).toBeTruthy();
  });

  it("reloads the members list when an invitation is sent, so the table behind shows the new row", async () => {
    const { server } = setup();
    await screen.findByRole("table", { name: "Members" });
    await userEvent.click(
      screen.getByRole("button", { name: "Invite members" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Invite members" });
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Email addresses" }),
      "new@example.com",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invitations" }),
    );
    await within(dialog).findByRole("list", { name: "Results" });
    await waitFor(() =>
      expect(
        server.calls.filter((c) => c.method === "GET" && c.path === "/members"),
      ).toHaveLength(2),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(
      await screen.findByText("new@example.com", { selector: "b" }),
    ).toBeTruthy();
  });

  it("places the Create channel button of TOKI-098 once in the Channels heading, and its onCreated reloads the channel list", async () => {
    const { server } = setup();
    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "Channels",
    });
    const plus = within(heading.parentElement as HTMLElement).getAllByTestId(
      "create-channel-stand-in",
    );
    expect(plus).toHaveLength(1);
    const before = server.calls.filter((c) => c.path === "/channels").length;
    await userEvent.click(plus[0]!);
    await waitFor(() =>
      expect(server.calls.filter((c) => c.path === "/channels")).toHaveLength(
        before + 1,
      ),
    );
  });

  it("leaves the Invite members button out when the permission function refuses", async () => {
    markSignedIn({ ...user, id: "u-002", role: "member" });
    setup();
    expect(screen.queryByRole("button", { name: "Invite members" })).toBeNull();
  });
});
