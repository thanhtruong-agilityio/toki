import {
  createConversationStore,
  type ConversationStore,
  type StoreApi,
} from "@toki/client-core";
import type {
  BootstrapConversation,
  BootstrapPerson,
  BootstrapResponse,
} from "@toki/shared";

// The test seam for the store (TOKI-033 plan, step 6): a REAL `createConversationStore` over a fake
// api, so the list cache of the real store is what the pane reads (R29 depends on it), and a mock of
// `src/client` that hands that store to the app. A test file mocks the client with
//
//   vi.mock("../../src/client", async () => (await import("../support/conversation-store")).clientModule());
//
// and calls `useFakeStore(body)` to make the store of that test.

export const ME = "me";

export const channel = (
  id: string,
  name: string,
  over: Partial<BootstrapConversation> = {},
): BootstrapConversation =>
  ({
    id,
    kind: "channel",
    name,
    topic: null,
    isPrivate: false,
    isGeneral: false,
    notificationLevel: "all",
    isMuted: false,
    isStarred: false,
    memberIds: null,
    ...over,
  }) as BootstrapConversation;

export const dm = (
  id: string,
  otherId: string,
  over: Partial<BootstrapConversation> = {},
): BootstrapConversation =>
  ({
    id,
    kind: "dm",
    name: null,
    topic: null,
    isPrivate: true,
    isGeneral: false,
    notificationLevel: "all",
    isMuted: false,
    isStarred: false,
    memberIds: [ME, otherId],
    ...over,
  }) as BootstrapConversation;

export const person = (
  id: string,
  displayName: string,
  status: BootstrapPerson["status"] = "active",
): BootstrapPerson => ({ id, displayName, role: "member", status });

export function workspaceBody(
  conversations: BootstrapConversation[],
  members: BootstrapPerson[] = [],
): BootstrapResponse {
  return {
    user: {
      id: ME,
      email: "me@example.com",
      displayName: "Me",
      role: "member",
      language: "en",
    },
    workspace: { id: "ws", name: "Acme" },
    members: [person(ME, "Me"), ...members],
    conversations,
    eventNumber: 1,
  };
}

export type StoreHarness = {
  store: ConversationStore;
  /** What the next `bootstrap()` answers. */
  answer(body: BootstrapResponse): void;
  /** Loads the store and lets the answer land. */
  loadNow(): Promise<void>;
  bootstrapCalls(): number;
  /** The next `bootstrap()` waits until the returned function is called. */
  holdNext(): () => void;
};

export function createStoreHarness(
  body: BootstrapResponse = workspaceBody([]),
): StoreHarness {
  let next = body;
  let calls = 0;
  let gate: Promise<void> | null = null;
  const api = {
    bootstrap: async () => {
      calls += 1;
      const wait = gate;
      gate = null;
      if (wait) await wait;
      return structuredClone(next);
    },
  } as unknown as StoreApi;
  const store = createConversationStore({ api });
  return {
    store,
    answer: (b) => void (next = b),
    loadNow: () => store.load(),
    bootstrapCalls: () => calls,
    holdNext() {
      let release!: () => void;
      gate = new Promise<void>((resolve) => void (release = resolve));
      return release;
    },
  };
}

const holder: { current: ConversationStore | null } = { current: null };
// The fake api of a test that needs more than `bootstrap` (tests/support/conversation-api.ts). While
// it is null, the mocked client keeps the real `api`, as it did before.
const apiHolder: { current: object | null } = { current: null };

// Makes the store of this test and installs it behind the mocked `src/client`.
export function useFakeStore(body?: BootstrapResponse): StoreHarness {
  const harness = createStoreHarness(body);
  holder.current = harness.store;
  apiHolder.current = null;
  return harness;
}

// Puts a store and the api it was made over behind the mocked `src/client` (conversation-api.ts).
export function installStore(store: ConversationStore, api: object): void {
  holder.current = store;
  apiHolder.current = api;
}

// The body of the `vi.mock` factory: the real client module with `conversations` replaced by a
// delegate to the store of the running test.
export async function clientModule() {
  const { vi } = await import("vitest");
  const actual =
    await vi.importActual<Record<string, unknown>>("../../src/client");
  const delegate = new Proxy({} as ConversationStore, {
    get(_target, key) {
      const store = holder.current;
      if (store === null) throw new Error("useFakeStore() was not called");
      const value = (store as unknown as Record<PropertyKey, unknown>)[key];
      return typeof value === "function" ? value.bind(store) : value;
    },
  });
  const apiDelegate = new Proxy({} as object, {
    get(_target, key) {
      const api = (apiHolder.current ?? actual.api) as Record<
        PropertyKey,
        unknown
      >;
      return api[key];
    },
  });
  return { ...actual, conversations: delegate, api: apiDelegate };
}
