import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { setPlatform, type StorageArea } from "@toki/platform";
import { Profiler, type ReactNode } from "react";
import { vi } from "vitest";
import { ConversationListPane } from "../../src/conversation-list/ConversationListPane";
import {
  ListActionsProvider,
  useRegisterListActions,
  type ListAction,
} from "../../src/conversation-list/list-actions";

export function fakeDevice(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const area: StorageArea = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: (key) => void data.delete(key),
    clear: () => data.clear(),
  };
  setPlatform({
    storage: { device: area, tab: area },
  } as unknown as Parameters<typeof setPlatform>[0]);
  return { area, data };
}

function Registrar({
  actions,
}: {
  actions: { browseChannels?: ListAction; startDirect?: ListAction } | null;
}) {
  useRegisterListActions(actions);
  return null;
}

// The pane inside a memory router with the routes it navigates to, and the providers it reads.
export async function mountPane(
  options: {
    path?: string;
    language?: Language;
    actions?: { browseChannels?: ListAction; startDirect?: ListAction } | null;
    extra?: ReactNode;
  } = {},
) {
  const onRender = vi.fn();
  const root = createRootRoute({
    component: () => (
      <I18nProvider language={options.language ?? "en"}>
        <ListActionsProvider>
          <Registrar actions={options.actions ?? null} />
          <Profiler id="pane" onRender={onRender}>
            <ConversationListPane />
          </Profiler>
          {options.extra}
          <Outlet />
        </ListActionsProvider>
      </I18nProvider>
    ),
  });
  const page = () => <p data-testid="page" />;
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/", component: page }),
    createRoute({
      getParentRoute: () => root,
      path: "/activity",
      component: page,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/c/$conversationId",
      component: page,
    }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [options.path ?? "/"] }),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return { router, renders: onRender };
}
