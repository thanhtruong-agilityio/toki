import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { adminRoute } from "./routes/admin";
import { appLayoutRoute } from "./routes/app-layout";
import { emergencyRoute } from "./routes/emergency";
import { indexRoute } from "./routes/index";
import { loginRoute } from "./routes/login";
import { preferencesRoute } from "./routes/preferences";

// The only place that creates the router. A later screen adds one route
// under src/routes/ and one entry to the children of appLayoutRoute here;
// /login (TOKI-023) is a child of the root, outside the layout.
export const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([indexRoute, adminRoute, preferencesRoute]),
  loginRoute,
  emergencyRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
