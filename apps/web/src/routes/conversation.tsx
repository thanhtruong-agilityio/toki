import { createRoute } from "@tanstack/react-router";
import { appLayoutRoute } from "./app-layout";

// `/c/$conversationId` (R21). The body arrives with the pages of this ticket; `validateSearch`
// returns no search parameter, which TOKI-035 extends with `panel`.
export const conversationRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/c/$conversationId",
  validateSearch: () => ({}),
  component: () => null,
});
