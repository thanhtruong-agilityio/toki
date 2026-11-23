// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { markSignedIn } from "@toki/client-core";
import { I18nProvider } from "@toki/i18n/react";
import { describe, expect, test } from "vitest";
import { useForbidden } from "../../src/admin/AdminForbiddenContext";
import { AdminRoute } from "../../src/admin/AdminRoute";
import { user } from "../support/auth-harness";

// The page of this test asks for the no-access view the way a request that is answered 403 does.
function ForbiddenPage() {
  const forbidden = useForbidden();
  return (
    <button type="button" onClick={forbidden}>
      send a request
    </button>
  );
}

async function mount(role: "admin" | "member") {
  markSignedIn({ ...user, role });
  await act(async () => {
    render(
      <I18nProvider language="en">
        <AdminRoute page={ForbiddenPage} />
      </I18nProvider>,
    );
  });
}

describe("AdminRoute (TOKI-025 R3, R4, R19)", () => {
  test("a 403 from a request switches an Admin's page to the no-access view", async () => {
    await mount("admin");
    await userEvent.click(
      screen.getByRole("button", { name: "send a request" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "You do not have access to this page",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("the no-access view of one Admin does not follow another Admin who signs in (review)", async () => {
    await mount("admin");
    await userEvent.click(
      screen.getByRole("button", { name: "send a request" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "You do not have access to this page",
      }),
    ).toBeInTheDocument();
    await act(async () => {
      markSignedIn({ ...user, id: "other-admin", role: "admin" });
    });
    expect(
      screen.getByRole("button", { name: "send a request" }),
    ).toBeInTheDocument();
  });

  test("a Member never gets the page, so the page's code does not run", async () => {
    await mount("member");
    expect(screen.queryByRole("button", { name: "send a request" })).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "You do not have access to this page",
      }),
    ).toBeInTheDocument();
  });
});
