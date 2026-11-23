import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
  type RouterHistory,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import { ToastProvider } from "@toki/ui-web";
import { type ReactNode } from "react";
import { validatePanelSearch } from "../../src/conversation/useDetailsPanel";

// A memory router with the route of the conversation (`validateSearch` of the real one) that draws
// `draw(conversationId)` inside the providers of the patterns, and `/` as the list. A test passes a
// path (or its own history, to reload) and gets the router back.
export async function mountConversation(
  draw: (conversationId: string) => ReactNode,
  options: {
    path?: string;
    history?: RouterHistory;
    language?: "en" | "vi";
  } = {},
) {
  const root = createRootRoute({
    component: () => (
      <I18nProvider language={options.language}>
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </I18nProvider>
    ),
  });
  const Page = () => {
    const { conversationId } = useParams({ strict: false }) as {
      conversationId: string;
    };
    return draw(conversationId);
  };
  const conversationRoute = createRoute({
    getParentRoute: () => root,
    path: "/c/$conversationId",
    validateSearch: validatePanelSearch,
    component: Page,
  });
  const routeTree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => <p data-testid="list">list</p>,
    }),
    conversationRoute,
  ]);
  const router = createRouter({
    routeTree,
    history:
      options.history ??
      createMemoryHistory({ initialEntries: [options.path ?? "/c/c1"] }),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return router;
}
