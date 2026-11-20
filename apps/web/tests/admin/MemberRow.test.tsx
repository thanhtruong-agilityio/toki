// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { FormatContext } from "@toki/shared";
import { I18nProvider } from "@toki/i18n/react";
import { describe, expect, it } from "vitest";
import type { InvitationView, MemberRowView } from "../../src/admin/adminApi";
import { MemberRow } from "../../src/admin/MemberRow";

const CTX: FormatContext = {
  now: Date.UTC(2026, 0, 10, 12),
  timeZone: "UTC",
  language: "en",
  dayWords: { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" },
};

const INVITATION: InvitationView = {
  id: "inv-1",
  role: "member",
  state: "pending",
  mailStatus: "sent",
  invitedBy: { id: "u-admin", displayName: "Lan" },
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  sentAt: Date.UTC(2026, 0, 2, 3, 4, 6),
  expiresAt: Date.UTC(2026, 0, 9, 3, 4, 5),
};

const ACCOUNT: MemberRowView = {
  kind: "account",
  userId: "u-2",
  email: "minh@example.com",
  displayName: "Minh",
  role: "member",
  status: "active",
  lastActiveAt: Date.UTC(2026, 0, 10, 9, 30),
  invitation: null,
};

const INVITE: MemberRowView = {
  kind: "invitation",
  userId: null,
  email: "sam@example.com",
  displayName: null,
  role: "member",
  status: "invited",
  lastActiveAt: null,
  invitation: INVITATION,
};

function renderRow(row: MemberRowView, actorId = "u-admin") {
  render(
    <I18nProvider language="en">
      <table>
        <tbody>
          <MemberRow
            row={row}
            actorId={actorId}
            ctx={CTX}
            nameCellId="name-1"
            actions={<button type="button">act</button>}
          />
        </tbody>
      </table>
    </I18nProvider>,
  );
  const tr = screen.getByRole("row");
  const cells = within(tr).getAllByRole("cell");
  return { tr, cells };
}

describe("MemberRow (TOKI-025 R12, R13)", () => {
  it("an active person: name, address, role, status and last active", () => {
    const { cells } = renderRow(ACCOUNT);
    expect(cells).toHaveLength(5);
    expect(cells[0]).toHaveTextContent("Minh");
    expect(cells[0]).toHaveTextContent("minh@example.com");
    expect(cells[1]).toHaveTextContent("Member");
    expect(cells[2]).toHaveTextContent("Active");
    expect(cells[3]).toHaveTextContent("Today 09:30");
  });

  it("an Admin reads Admin in the role cell", () => {
    const { cells } = renderRow({ ...ACCOUNT, role: "admin" });
    expect(cells[1]).toHaveTextContent("Admin");
  });

  it("a deactivated person reads Deactivated", () => {
    const { cells } = renderRow({ ...ACCOUNT, status: "deactivated" });
    expect(cells[2]).toHaveTextContent("Deactivated");
  });

  it("the signed-in person's own row has a You tag beside the name", () => {
    const { cells } = renderRow(ACCOUNT, "u-2");
    expect(within(cells[0]!).getByText("You")).toBeInTheDocument();
    cleanup();
    const other = renderRow(ACCOUNT, "u-other");
    expect(within(other.cells[0]!).queryByText("You")).toBeNull();
  });

  it("an invitation: the address is the name, with who invited and when, and no last active", () => {
    const { cells } = renderRow(INVITE);
    expect(cells[0]).toHaveTextContent("sam@example.com");
    expect(cells[0]).toHaveTextContent("Invited by Lan · Fri 2 Jan");
    expect(cells[2]).toHaveTextContent("Invited");
    expect(cells[3]).toHaveTextContent("—");
  });

  it("a pending invitation whose mail failed reads Mail not sent", () => {
    const { cells } = renderRow({
      ...INVITE,
      invitation: { ...INVITATION, mailStatus: "failed" },
    });
    expect(cells[2]).toHaveTextContent("Mail not sent");
  });

  it("an expired invitation reads Expired whatever its mail status", () => {
    const { cells } = renderRow({
      ...INVITE,
      status: "expired",
      invitation: { ...INVITATION, state: "expired", mailStatus: "failed" },
    });
    expect(cells[2]).toHaveTextContent("Expired");
    expect(cells[2]).not.toHaveTextContent("Mail not sent");
  });

  it("a deactivated person with a pending invitation is an account row", () => {
    const { cells } = renderRow({
      ...ACCOUNT,
      status: "deactivated",
      invitation: INVITATION,
    });
    expect(cells[2]).toHaveTextContent("Deactivated");
    expect(cells[0]).not.toHaveTextContent("Invited by");
    expect(cells[0]).toHaveTextContent("minh@example.com");
  });

  it("shows a dash for a date that is null", () => {
    const { cells } = renderRow({ ...ACCOUNT, lastActiveAt: null });
    expect(cells[3]).toHaveTextContent("—");
    cleanup();
    const invite = renderRow({
      ...INVITE,
      invitation: { ...INVITATION, createdAt: null },
    });
    expect(invite.cells[0]).toHaveTextContent("Invited by Lan · —");
  });

  it("names the columns for the narrow layout and gives the cells their roles", () => {
    const { tr, cells } = renderRow(ACCOUNT);
    expect(tr).toHaveAttribute("role", "row");
    expect(cells[1]).toHaveAttribute("data-label", "Role");
    expect(cells[2]).toHaveAttribute("data-label", "Status");
    expect(cells[3]).toHaveAttribute("data-label", "Last active");
    expect(cells[0]).toHaveAttribute("id", "name-1");
  });

  it("holds the actions in the last cell and leads nowhere", () => {
    const { tr, cells } = renderRow(INVITE);
    expect(within(cells[4]!).getByRole("button", { name: "act" })).toBeTruthy();
    expect(tr.querySelector("a, [href]")).toBeNull();
  });
});
