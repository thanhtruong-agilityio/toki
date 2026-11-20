// R27: every member of the table "Contract for the screens" is called with the
// arguments shown and read with the types shown. This file fails to compile
// when a name or a signature changes (`pnpm typecheck`).
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  BootstrapConversation,
  ChannelDetail,
  ChannelSummary,
} from "@toki/shared";
import {
  ApiError,
  classifyApiError,
  createApiClient,
  createConversationStore,
  foldSearchText,
  type ConversationList,
  type ConversationState,
  type ErrorScreen,
} from "./index";
import { fakeApi } from "./conversations/test-support";

describe("the contract for the screens (R27)", () => {
  const store = createConversationStore({ api: fakeApi().api });

  it("has every member of the table with the signatures shown", () => {
    expectTypeOf(store.getState).toEqualTypeOf<() => ConversationState>();
    expectTypeOf(store.subscribe).toEqualTypeOf<
      (listener: () => void) => () => void
    >();
    expectTypeOf(store.load).toEqualTypeOf<() => Promise<void>>();
    expectTypeOf(store.refresh).toEqualTypeOf<() => Promise<void>>();
    expectTypeOf(store.reset).toEqualTypeOf<() => void>();
    expectTypeOf(store.getList)
      .parameter(0)
      .toEqualTypeOf<
        { query?: string; filter?: "all" | "unread" | "mentions" } | undefined
      >();
    expectTypeOf(store.getList).returns.toEqualTypeOf<ConversationList>();
    expectTypeOf(store.getConversationName).toEqualTypeOf<
      (id: string) => string
    >();
    expectTypeOf(store.getConversation).returns.toEqualTypeOf<
      BootstrapConversation | undefined
    >();
    expectTypeOf(store.hasConversation).returns.toEqualTypeOf<boolean>();
    expectTypeOf(store.getGeneralId).returns.toEqualTypeOf<string | null>();
    expectTypeOf(store.getPerson(" ")).not.toBeAny();
    expectTypeOf(store.getPeople).returns.not.toBeAny();
    expectTypeOf(store.getUser).returns.not.toBeAny();
    expectTypeOf(store.getWorkspace).returns.not.toBeAny();
    expectTypeOf(store.getEventNumber).returns.toEqualTypeOf<number>();
    expectTypeOf(store.getChannelDetail).returns.toEqualTypeOf<
      ChannelDetail | ChannelSummary | undefined
    >();
    expectTypeOf(store.getMemberCount).returns.toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf(store.readChannel).returns.resolves.toEqualTypeOf<
      ChannelDetail | ChannelSummary
    >();
    expectTypeOf(store.joinChannel).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(store.leaveChannel).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(store.editChannel).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(store.archiveChannel).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(store.restoreChannel).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(store.createChannel).returns.resolves.toEqualTypeOf<{
      id: string;
      created: boolean;
    }>();
    expectTypeOf(store.openDirect).returns.resolves.toEqualTypeOf<{
      id: string;
      created: boolean;
    }>();
    expectTypeOf(store.saveSettings).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(store.setUnread).toEqualTypeOf<
      (id: string, value: { count: number; mention: boolean }) => void
    >();
    expectTypeOf(store.clearUnread).toEqualTypeOf<(id: string) => void>();
    // a call with the arguments shown compiles
    void [
      () => store.joinChannel("c", { notificationLevel: "all", isMuted: true }),
      () => store.editChannel("c", { topic: "t", description: null }),
      () => store.saveSettings("c", { isStarred: true }),
      () => store.getList({ query: "a", filter: "unread" }),
    ];
    expect(store.refresh).toBe(store.load);
  });

  it("has the client and the helpers", () => {
    const api = createApiClient({ timers: { after: () => () => {} } });
    expectTypeOf(api.request).toBeFunction();
    expectTypeOf(api.setOnUnauthenticated)
      .parameter(0)
      .toEqualTypeOf<((code: string) => void) | null>();
    expectTypeOf(api.bootstrap).toBeFunction();
    expectTypeOf(api.channels.list).toBeFunction();
    expectTypeOf(api.directConversations.open).toBeFunction();
    expectTypeOf(api.conversations.saveSettings).toBeFunction();
    expectTypeOf(classifyApiError).returns.toEqualTypeOf<ErrorScreen>();
    expectTypeOf(foldSearchText).toEqualTypeOf<(text: string) => string>();
    expect(new ApiError({ kind: "network" }).requestId).toBeNull();
  });
});
