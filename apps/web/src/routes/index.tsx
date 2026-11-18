import { createRoute } from "@tanstack/react-router";
import { appLayoutRoute } from "./app-layout";

export const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: () => <p data-testid="app-root">Toki</p>,
});
