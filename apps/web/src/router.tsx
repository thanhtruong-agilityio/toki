import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { appLayoutRoute } from "./routes/app-layout";
import { emergencyRoute } from "./routes/emergency";
import { indexRoute } from "./routes/index";
import { joinRoute } from "./routes/join";
import { loginRoute } from "./routes/login";

// The only place that creates the router. A later screen adds one route
// under src/routes/ and one entry to the children of appLayoutRoute here;
// /login (TOKI-023), /emergency (TOKI-026) and /join (TOKI-097) are children of the root, outside the layout.
export const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([indexRoute]),
  loginRoute,
  emergencyRoute,
  joinRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
