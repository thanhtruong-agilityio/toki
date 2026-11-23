import {
  ApiError,
  createConversationStore,
  type ChannelRead,
  type ConversationStore,
  type SettingsValues,
  type StoreApi,
} from "@toki/client-core";
import type { BootstrapResponse } from "@toki/shared";
import { vi } from "vitest";
import {
  installStore,
  workspaceBody,
  type StoreHarness,
} from "./conversation-store";

// A fake api for the screens of TOKI-035 (plan, decision 9): `channels.get/update/leave/join/members`
// and `conversations.saveSettings` over a small in-memory server, each one a `vi.fn` so a test can
// answer another way for one call. The store is the REAL `createConversationStore` over it, and the
// mocked `src/client` hands both to the app (see `installStore`). The harness of
// conversation-store.ts only gained `installStore` and an `api` delegate that falls back to the real
// `api` when nothing is installed, so the other tests behave as before; a test that needs this file
// calls `useFakeApi`.

export type MemberRow = { userId: string; joinedAt: string };

export const http = (status: number, code: string | null = null) =>
  new ApiError({ kind: "http", status, code });

export const detail = (
  id: string,
  name: string,
  over: Partial<ChannelRead> = {},
): ChannelRead =>
  ({
    id,
    name,
    topic: null,
    isPrivate: false,
    isGeneral: false,
    archived: false,
    memberCount: 3,
    isMember: true,
    description: null,
    createdBy: "me",
    createdAt: "2025-01-08T10:00:00.000Z",
    ...over,
  }) as ChannelRead;

export const summary = (
  id: string,
  name: string,
  over: Partial<ChannelRead> = {},
): ChannelRead => {
  const { description, createdBy, createdAt, ...rest } = detail(
    id,
    name,
  ) as ChannelRead & Record<string, unknown>;
  void [description, createdBy, createdAt];
  return { ...rest, ...over } as ChannelRead;
};

export const members = (count: number, prefix = "p"): MemberRow[] =>
  Array.from({ length: count }, (_, i) => ({
    userId: `${prefix}${i + 1}`,
    joinedAt: "2025-01-08T10:00:00.000Z",
  }));

export type FakeApiHarness = StoreHarness & {
  store: ConversationStore;
  /** The server's channel reads and member lists; a test edits them. */
  details: Record<string, ChannelRead>;
  memberRows: Record<string, MemberRow[]>;
  settings: Record<string, SettingsValues>;
  api: {
    bootstrap: ReturnType<typeof vi.fn>;
    channels: {
      get: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      leave: ReturnType<typeof vi.fn>;
      join: ReturnType<typeof vi.fn>;
      members: ReturnType<typeof vi.fn>;
      archive: ReturnType<typeof vi.fn>;
      restore: ReturnType<typeof vi.fn>;
    };
    conversations: { saveSettings: ReturnType<typeof vi.fn> };
  };
};

export function useFakeApi(
  body: BootstrapResponse = workspaceBody([]),
  server: {
    details?: ChannelRead[];
    members?: Record<string, MemberRow[]>;
  } = {},
): FakeApiHarness {
  let next = body;
  let calls = 0;
  let gate: Promise<void> | null = null;
  const details: Record<string, ChannelRead> = Object.fromEntries(
    (server.details ?? []).map((d) => [d.id, d]),
  );
  const memberRows = { ...(server.members ?? {}) };
  const settings: Record<string, SettingsValues> = Object.fromEntries(
    body.conversations.map((c) => [
      c.id,
      {
        notificationLevel: c.notificationLevel,
        isMuted: c.isMuted,
        isStarred: c.isStarred,
      },
    ]),
  );

  const need = (id: string): ChannelRead => {
    const found = details[id];
    if (!found) throw http(404);
    return found;
  };

  const api = {
    bootstrap: vi.fn(async () => {
      calls += 1;
      const wait = gate;
      gate = null;
      if (wait) await wait;
      return structuredClone(next);
    }),
    channels: {
      get: vi.fn(async (id: string) => ({
        channel: structuredClone(need(id)),
      })),
      update: vi.fn(
        async (
          id: string,
          patch: { topic?: string | null; description?: string | null },
        ) => {
          const held = need(id) as ChannelRead & {
            description?: string | null;
          };
          const after = { ...held, ...patch } as ChannelRead;
          const changed = JSON.stringify(after) !== JSON.stringify(held);
          details[id] = after;
          return { channel: structuredClone(after), changed };
        },
      ),
      leave: vi.fn(async (id: string) => {
        need(id);
        return { changed: true, archived: false };
      }),
      join: vi.fn(async (id: string) => ({
        channel: structuredClone(need(id)),
        changed: true,
      })),
      // TOKI-101: archive and restore over the same in-memory server (a repeat answers changed false).
      archive: vi.fn(async (id: string) => {
        const held = need(id);
        const after = { ...held, archived: true } as ChannelRead;
        details[id] = after;
        return { channel: structuredClone(after), changed: !held.archived };
      }),
      restore: vi.fn(async (id: string) => {
        const held = need(id);
        const after = {
          ...held,
          archived: false,
          isMember: true,
        } as ChannelRead;
        details[id] = after;
        return { channel: structuredClone(after), changed: held.archived };
      }),
      members: vi.fn(
        async (id: string, query: { limit?: number; cursor?: string } = {}) => {
          const all = memberRows[id] ?? [];
          const start = query.cursor === undefined ? 0 : Number(query.cursor);
          const size = query.limit ?? 50;
          const page = all.slice(start, start + size);
          const end = start + page.length;
          return {
            members: page,
            nextCursor: end < all.length ? String(end) : null,
          };
        },
      ),
    },
    conversations: {
      saveSettings: vi.fn(
        async (id: string, patch: Partial<SettingsValues>) => {
          const before = settings[id];
          if (!before) throw http(404);
          const after = { ...before, ...patch };
          const changed = JSON.stringify(after) !== JSON.stringify(before);
          settings[id] = after;
          return { settings: { ...after }, changed };
        },
      ),
    },
  };

  const store = createConversationStore({ api: api as unknown as StoreApi });
  installStore(store, api);
  return {
    store,
    api,
    details,
    memberRows,
    settings,
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

// `count` people named "Member 001", "Member 002", ... with the ids "p1", "p2", ... for the body of
// the store, and the member rows of the server for them.
export const crowd = (count: number) => ({
  people: Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    displayName: `Member ${String(i + 1).padStart(3, "0")}`,
    role: "member" as const,
    status: "active" as const,
  })),
  rows: members(count),
});
