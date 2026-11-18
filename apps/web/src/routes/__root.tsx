import { createRootRoute, Outlet } from "@tanstack/react-router";

export const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <p>Page not found</p>,
});
