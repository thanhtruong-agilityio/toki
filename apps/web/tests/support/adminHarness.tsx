import { render } from "@testing-library/react";
import { vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { MembersSection } from "../../src/admin/MembersSection";
import { useMemberList } from "../../src/admin/useMemberList";
import {
  createFakeAdminServer,
  invitation,
  person,
  type FakeAdminServerOptions,
  type FakeMember,
} from "./fakeAdminServer";
import { installFakeIntersectionObserver } from "./fakeIntersection";
import { Providers } from "./providers";

// The signed-in Admin of the tests: Lan, the first person of `directory()`.
export const ME = { id: "u-001", role: "admin" };

// A small workspace: two Admins (Lan, who is the actor, and Ann), a Member, a deactivated person,
// and two invitations (one whose mail failed).
export function directory(): FakeMember[] {
  return [
    person({ n: 1, displayName: "Lan", role: "admin" }),
    person({ n: 2, displayName: "Minh" }),
    person({ n: 3, displayName: "Ann", role: "admin" }),
    person({ n: 4, displayName: "Bo", status: "deactivated" }),
    invitation({ n: 1 }),
    invitation({ n: 2, mailStatus: "failed" }),
  ];
}

// Renders the members section with the real list hook, the fake server as `fetch`, the toast region
// and a spy for the 403 callback.
export function renderMembers(
  options: FakeAdminServerOptions = { members: directory() },
  actor: { id: string; role: string } = ME,
) {
  const io = installFakeIntersectionObserver();
  const server = createFakeAdminServer(options).install();
  const forbidden = vi.fn();
  function Page() {
    const list = useMemberList();
    return <MembersSection list={list} actor={actor} />;
  }
  const view = render(
    <Providers>
      <AdminForbiddenContext.Provider value={forbidden}>
        <Page />
      </AdminForbiddenContext.Provider>
    </Providers>,
  );
  return { server, forbidden, io, ...view };
}

// The text of the toast region.
export const toastText = () =>
  document.querySelector(".toasts")?.textContent ?? "";
