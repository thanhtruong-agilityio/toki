import { createContext, useContext } from "react";

// Any request of the Admin page that is answered 403 means the person is no longer an Admin, so the
// page is replaced by the no-access view (TOKI-025 R4, R19, R32). `AdminRoute` provides the function;
// the hooks and dialogs that send requests call it.
export const AdminForbiddenContext = createContext<(() => void) | null>(null);

export function useForbidden(): () => void {
  const forbidden = useContext(AdminForbiddenContext);
  if (forbidden === null) {
    throw new Error("useForbidden must be used inside AdminRoute");
  }
  return forbidden;
}
