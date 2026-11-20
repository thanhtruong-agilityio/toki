import { createRoute } from "@tanstack/react-router";
import { AdminRoute } from "../admin/AdminRoute";
import { appLayoutRoute } from "./app-layout";

// `/admin`, inside the shell (TOKI-025 R1): no search parameter. The gate is in `AdminRoute`.
export const adminRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/admin",
  component: AdminRoute,
});
