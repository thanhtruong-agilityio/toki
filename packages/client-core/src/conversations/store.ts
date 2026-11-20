import type {
  BootstrapConversation,
  BootstrapResponse,
  DirectConversationEntry,
} from "@toki/shared";
import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { contradicted, entryFromChannel, isActiveMember } from "./merge";
import { conversationName } from "./names";
import { buildList } from "./selectors";
import type {
  ChannelRead,
  ConversationList,
  ConversationState,
  ListFilter,
  SettingsValues,
  Unread,
} from "./types";

// The methods of the API client the store calls (TOKI-032 R9). A test passes a
// fake with these.
export type StoreApi = Pick<
  ApiClient,
  "bootstrap" | "channels" | "directConversations" | "conversations"
>;

const INITIAL: ConversationState = {
  status: "idle",
  isRefreshing: false,
  error: null,
  user: null,
  workspace: null,
  people: {},
  peopleList: [],
  conversations: {},
  details: {},
  unread: {},
  eventNumber: 0,
};

type Op = "add" | "remove" | "settings";

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError({ kind: "network" });
}

function sameEntry(a: BootstrapConversation, b: BootstrapConversation) {
  const keys = Object.keys(a) as (keyof BootstrapConversation)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const x = a[key];
    const y = b[key];
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.length === y.length && x.every((v, i) => v === y[i]);
    }
    return x === y;
  });
}

function sameRead(a: ChannelRead, b: ChannelRead) {
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return (
    keys.length === Object.keys(y).length && keys.every((k) => x[k] === y[k])
  );
}

export function createConversationStore({ api }: { api: StoreApi }) {
  let state: ConversationState = INITIAL;
  const listeners = new Set<() => void>();
  // Raised by reset(): an answer begun before it is ignored (R11).
  let generation = 0;
  let inflight: { promise: Promise<void>; controller: AbortController } | null =
    null;
  // What commands left, since the refresh in flight began (R26).
  let sequence = 0;
  let journal: { seq: number; id: string; op: Op }[] = [];
  const idCount = new Map<string, number>();
  const settingsStarted = new Map<string, number>();
  const settingsApplied = new Map<string, number>();

  // ---- results that are remembered between two changes (R22)
  let listCache = new Map<string, ConversationList>();
  let nameCache = new Map<string, string>();

  function commit(next: ConversationState): void {
    if (next === state) return;
    const previous = state;
    state = next;
    if (
      next.conversations !== previous.conversations ||
      next.people !== previous.people ||
      next.unread !== previous.unread ||
      next.user !== previous.user
    ) {
      listCache = new Map();
      nameCache = new Map();
    }
    for (const listener of [...listeners]) listener();
  }

  function note(id: string, op: Op): void {
    sequence += 1;
    journal.push({ seq: sequence, id, op });
    if (op !== "settings") idCount.set(id, (idCount.get(id) ?? 0) + 1);
  }

  // The state after a channel answer (R13, R14). Returns null when nothing
  // changes, so no listener is called.
  function withChannel(
    channel: ChannelRead,
    values?: Partial<SettingsValues>,
  ): ConversationState | null {
    const held = state.conversations[channel.id];
    let conversations = state.conversations;
    if (isActiveMember(channel)) {
      const entry = entryFromChannel(channel, held, values);
      if (!held || !sameEntry(held, entry)) {
        conversations = { ...conversations, [channel.id]: entry };
      }
    } else if (held) {
      const { [channel.id]: _gone, ...rest } = conversations;
      conversations = rest;
    }
    const heldDetail = state.details[channel.id];
    const details =
      heldDetail && sameRead(heldDetail, channel)
        ? state.details
        : { ...state.details, [channel.id]: channel };
    if (conversations === state.conversations && details === state.details) {
      return null;
    }
    return { ...state, conversations, details };
  }

  function removeChannel(id: string, keepDetail?: ChannelRead): void {
    const { [id]: _entry, ...conversations } = state.conversations;
    let details = state.details;
    if (keepDetail) details = { ...details, [id]: keepDetail };
    else {
      const { [id]: _detail, ...rest } = details;
      details = rest;
    }
    const changedEntries = id in state.conversations;
    const changedDetails = keepDetail
      ? !state.details[id] || !sameRead(state.details[id]!, keepDetail)
      : id in state.details;
    if (!changedEntries && !changedDetails) return;
    commit({
      ...state,
      conversations: changedEntries ? conversations : state.conversations,
      details: changedDetails ? details : state.details,
    });
  }

  // ---- first load and refresh (R10)
  function load(): Promise<void> {
    if (inflight) return inflight.promise;
    const mine = generation;
    const controller = new AbortController();
    const hadData = state.status === "ready";
    journal = [];
    const seqAtStart = sequence;
    if (hadData) commit({ ...state, isRefreshing: true });
    else commit({ ...state, status: "loading", error: null });

    const promise = (async () => {
      let answer: BootstrapResponse | undefined;
      let failure: ApiError | undefined;
      try {
        answer = await api.bootstrap(controller.signal);
      } catch (error) {
        failure = asApiError(error);
      }
      if (mine !== generation) return; // abandoned by reset(): changes nothing
      inflight = null;
      if (failure || !answer) {
        commit(
          state.status === "ready"
            ? { ...state, isRefreshing: false, error: failure ?? null }
            : {
                ...state,
                status: "failed",
                isRefreshing: false,
                error: failure ?? null,
              },
        );
        return;
      }
      applyBootstrap(answer, seqAtStart);
    })();
    inflight = { promise, controller };
    return promise;
  }

  function applyBootstrap(answer: BootstrapResponse, seqAtStart: number): void {
    // What commands left on an id since the request began.
    const touched = new Map<
      string,
      { presence?: "add" | "remove"; settings: boolean }
    >();
    for (const record of journal) {
      if (record.seq <= seqAtStart) continue;
      const slot = touched.get(record.id) ?? { settings: false };
      if (record.op === "settings") slot.settings = true;
      else slot.presence = record.op;
      touched.set(record.id, slot);
    }
    const listed = new Set(answer.conversations.map((c) => c.id));
    const conversations: Record<string, BootstrapConversation> = {};
    for (const entry of answer.conversations) conversations[entry.id] = entry;
    for (const [id, slot] of touched) {
      const current = state.conversations[id];
      if (slot.presence === "remove") delete conversations[id];
      else if (slot.presence === "add") {
        if (current) conversations[id] = current;
        else delete conversations[id];
      } else if (slot.settings) {
        const fromAnswer = conversations[id];
        if (fromAnswer && current) {
          conversations[id] = {
            ...fromAnswer,
            notificationLevel: current.notificationLevel,
            isMuted: current.isMuted,
            isStarred: current.isStarred,
          } as BootstrapConversation;
        } else delete conversations[id];
      }
    }
    const details: Record<string, ChannelRead> = {};
    for (const [id, detail] of Object.entries(state.details)) {
      if (touched.has(id) || !contradicted(detail, listed.has(id))) {
        details[id] = detail;
      }
    }
    const unread: Record<string, Unread> = {};
    for (const [id, slot] of Object.entries(state.unread)) {
      if (id in conversations) unread[id] = slot;
    }
    const people = Object.fromEntries(answer.members.map((p) => [p.id, p]));
    commit({
      status: "ready",
      isRefreshing: false,
      error: null,
      user: answer.user,
      workspace: answer.workspace,
      people,
      peopleList: [...answer.members],
      conversations,
      details,
      unread,
      eventNumber: answer.eventNumber,
    });
  }

  function reset(): void {
    // A command begun before this call must not apply its answer, also when
    // the store holds nothing and there is nothing to report.
    generation += 1;
    if (state === INITIAL && inflight === null) return;
    inflight?.controller.abort();
    inflight = null;
    journal = [];
    idCount.clear();
    settingsStarted.clear();
    settingsApplied.clear();
    commit(INITIAL);
  }

  // ---- commands (R15): the answer is applied when it comes, never before
  async function openDirect(
    userIds: string[],
  ): Promise<{ id: string; created: boolean }> {
    const mine = generation;
    const { conversation, created } =
      await api.directConversations.open(userIds);
    if (mine === generation) {
      const entry: DirectConversationEntry = conversation;
      const held = state.conversations[entry.id];
      note(entry.id, "add");
      if (!held || !sameEntry(held, entry)) {
        commit({
          ...state,
          conversations: { ...state.conversations, [entry.id]: entry },
        });
      }
    }
    return { id: conversation.id, created };
  }

  async function createChannel(
    body: Parameters<StoreApi["channels"]["create"]>[0],
  ): Promise<{ id: string; created: boolean }> {
    const mine = generation;
    const { channel, created } = await api.channels.create(body);
    if (mine === generation) {
      note(channel.id, "add");
      const next = withChannel(channel);
      if (next) commit(next);
    }
    return { id: channel.id, created };
  }

  async function joinChannel(
    id: string,
    settings?: Partial<SettingsValues>,
  ): Promise<void> {
    const mine = generation;
    const { channel, changed } = await api.channels.join(id, settings);
    if (mine !== generation) return;
    note(channel.id, "add");
    const next = withChannel(channel, changed ? settings : undefined);
    if (next) commit(next);
  }

  async function leaveChannel(id: string): Promise<void> {
    const mine = generation;
    await api.channels.leave(id);
    if (mine !== generation) return;
    note(id, "remove");
    removeChannel(id);
  }

  async function editChannel(
    id: string,
    patch: Parameters<StoreApi["channels"]["update"]>[1],
  ): Promise<void> {
    const mine = generation;
    const { channel } = await api.channels.update(id, patch);
    if (mine !== generation) return;
    note(channel.id, "add");
    const next = withChannel(channel);
    if (next) commit(next);
  }

  async function archiveChannel(id: string): Promise<void> {
    const mine = generation;
    const { channel } = await api.channels.archive(id);
    if (mine !== generation) return;
    note(id, "remove");
    removeChannel(id, channel);
  }

  async function restoreChannel(id: string): Promise<void> {
    const mine = generation;
    const { channel } = await api.channels.restore(id);
    if (mine !== generation) return;
    note(channel.id, "add");
    const next = withChannel(channel);
    if (next) commit(next);
    // The member row of a restored channel kept its level, mute and star, and
    // the client no longer holds them: a refresh brings them. One that began
    // before the restore would not, so wait for it first.
    if (inflight) await inflight.promise;
    if (mine !== generation) return;
    await refresh();
  }

  async function saveSettings(
    id: string,
    patch: Partial<SettingsValues>,
  ): Promise<void> {
    const mine = generation;
    const number = (settingsStarted.get(id) ?? 0) + 1;
    settingsStarted.set(id, number);
    const { settings } = await api.conversations.saveSettings(id, patch);
    if (mine !== generation) return;
    // An answer of an earlier call that comes after a later call was applied
    // is not applied.
    if (number < (settingsApplied.get(id) ?? 0)) return;
    settingsApplied.set(id, number);
    const held = state.conversations[id];
    if (!held) return;
    const next = {
      ...held,
      notificationLevel: settings.notificationLevel,
      isMuted: settings.isMuted,
      isStarred: settings.isStarred,
    } as BootstrapConversation;
    if (sameEntry(held, next)) return;
    note(id, "settings");
    commit({ ...state, conversations: { ...state.conversations, [id]: next } });
  }

  async function readChannel(id: string): Promise<ChannelRead> {
    const mine = generation;
    const countAtStart = idCount.get(id) ?? 0;
    const { channel } = await api.channels.get(id);
    if (mine === generation && (idCount.get(id) ?? 0) === countAtStart) {
      const next = withChannel(channel);
      if (next) commit(next);
    }
    return channel;
  }

  // The slot that the read pointer fills (R20).
  function setUnread(id: string, value: Unread): void {
    const held = state.unread[id];
    if (held && held.count === value.count && held.mention === value.mention) {
      return;
    }
    commit({ ...state, unread: { ...state.unread, [id]: { ...value } } });
  }
  function clearUnread(id: string): void {
    if (!(id in state.unread)) return;
    const { [id]: _gone, ...rest } = state.unread;
    commit({ ...state, unread: rest });
  }

  // ---- reads (R17, R21 to R23): they send no request
  function getConversationName(id: string): string {
    const cached = nameCache.get(id);
    if (cached !== undefined) return cached;
    const entry = state.conversations[id];
    const name = entry
      ? conversationName(entry, state.user?.id, state.people)
      : "";
    nameCache.set(id, name);
    return name;
  }

  function getList(
    options: { query?: string; filter?: ListFilter } = {},
  ): ConversationList {
    const query = options.query ?? "";
    const filter = options.filter ?? "all";
    const key = `${filter}\u0000${query}`;
    const cached = listCache.get(key);
    if (cached) return cached;
    const list = buildList(state, getConversationName, query, filter);
    listCache.set(key, list);
    return list;
  }

  function refresh(): Promise<void> {
    return load();
  }

  return {
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    refresh: load,
    reset,
    getList,
    getConversationName,
    getConversation: (id: string) => state.conversations[id],
    hasConversation: (id: string) => id in state.conversations,
    getGeneralId: () =>
      Object.values(state.conversations).find((c) => c.isGeneral)?.id ?? null,
    getPerson: (id: string) => state.people[id],
    getPeople: () => state.peopleList,
    getUser: () => state.user,
    getWorkspace: () => state.workspace,
    getEventNumber: () => state.eventNumber,
    getChannelDetail: (id: string) => state.details[id],
    getMemberCount(id: string): number | undefined {
      const entry = state.conversations[id];
      if (entry && entry.kind !== "channel") return entry.memberIds.length;
      return state.details[id]?.memberCount;
    },
    readChannel,
    joinChannel,
    leaveChannel,
    editChannel,
    archiveChannel,
    restoreChannel,
    createChannel,
    openDirect,
    saveSettings,
    setUnread,
    clearUnread,
  };
}

export type ConversationStore = ReturnType<typeof createConversationStore>;
