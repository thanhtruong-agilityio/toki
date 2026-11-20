import { canOpenAdminPage } from "@toki/shared";
import { useState, type ComponentType } from "react";
import { useSession } from "../useSession";
import { AdminForbiddenContext } from "./AdminForbiddenContext";
import { AdminPage } from "./AdminPage";
import { NoAccess } from "./NoAccess";

// The gate of the Admin page (TOKI-025 R3). It reads the person from the session state through the
// one React binding the shell uses and asks the permission function of `@toki/shared`. A person who
// may not open the page gets the view of R4 and the page's code never runs, so no request is sent.
// The check only shapes the screen; the server repeats it on every request (BR-09, D-090).
// `page` is for tests: the route renders `AdminPage`.
export function AdminRoute({
  page: Page = AdminPage,
}: { page?: ComponentType } = {}) {
  const session = useSession();
  // The person a 403 was seen for: another person who signs in is not held out by it.
  const [forbiddenFor, setForbiddenFor] = useState<string | null>(null);
  const person = session.status === "signedIn" ? session.user : undefined;
  const forbidden = person !== undefined && forbiddenFor === person.id;
  if (
    person === undefined ||
    !canOpenAdminPage({ id: person.id, role: person.role }).allowed ||
    forbidden
  ) {
    return <NoAccess />;
  }
  return (
    <AdminForbiddenContext.Provider value={() => setForbiddenFor(person.id)}>
      <Page />
    </AdminForbiddenContext.Provider>
  );
}
