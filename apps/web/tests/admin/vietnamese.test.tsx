// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import { ToastProvider } from "@toki/ui-web";
import { markSignedIn } from "@toki/client-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { AdminPage } from "../../src/admin/AdminPage";
import { user } from "../support/auth-harness";
import { directory } from "../support/adminHarness";
import {
  createFakeAdminServer,
  manyChannels,
} from "../support/fakeAdminServer";
import { installFakeIntersectionObserver } from "../support/fakeIntersection";

beforeEach(() => {
  installFakeIntersectionObserver();
  markSignedIn({ ...user, id: "u-001", role: "admin", language: "vi" });
});

// R28: the page in Vietnamese shows no English word except `Join` (the button of the mail) and
// `Admin` (the role's name, as the product and the prototype call it).
const ENGLISH = [
  "Members",
  "Invite",
  "Search",
  "Filter",
  "Active",
  "Invited",
  "Expired",
  "Deactivated",
  "Role",
  "Status",
  "Last active",
  "Actions",
  "Resend",
  "Revoke",
  "Channels",
  "Retry",
  "Loading",
  "Archived",
  "Nobody",
  "Change role",
  "Deactivate",
  "Reactivate",
  "Close",
  "Cancel",
  "Name",
  "You",
];

describe("the page in Vietnamese (TOKI-025 R28)", () => {
  it("shows no English word from the page's vocabulary", async () => {
    createFakeAdminServer({
      members: directory(),
      channels: manyChannels(2),
    }).install();
    render(
      <I18nProvider language="vi">
        <ToastProvider>
          <AdminForbiddenContext.Provider value={vi.fn()}>
            <AdminPage />
          </AdminForbiddenContext.Provider>
        </ToastProvider>
      </I18nProvider>,
    );
    await screen.findByRole("table", { name: "Thành viên" });
    await screen.findByRole("table", { name: "Kênh" });
    const text = document.body.textContent ?? "";
    for (const word of ENGLISH) {
      expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
    // The role's name stays Admin, and the heading and the title are read in Vietnamese.
    expect(text).toContain("Admin");
    expect(text).toContain("Thành viên");
  });
});
