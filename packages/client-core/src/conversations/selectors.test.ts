import { describe, expect, it } from "vitest";
import { detailBody, id } from "../api/fixtures";
import { createConversationStore } from "./store";
import { body, fakeApi } from "./test-support";

async function loaded(edit?: Parameters<typeof body>[0]) {
  const fake = fakeApi();
  const store = createConversationStore({ api: fake.api });
  fake.answer("bootstrap", body(edit));
  await store.load();
  return { fake, store };
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("the list (R21)", () => {
  it("groups starred, channels and direct, each in name order", async () => {
    const { store } = await loaded();
    const list = store.getList();
    // Starred: the starred dm "Alex Phạm" and the starred channel, by name.
    expect(ids(list.starred)).toEqual([id(20), id(11)]);
    expect(ids(list.channels)).toEqual([id(10), id(12)]); // general, secret-plan
    // Direct: the group "Alex Phạm, Thu Hoàng" before "Dee".
    expect(ids(list.direct)).toEqual([id(22), id(21)]);
    expect(list.isEmpty).toBe(false);
  });

  it("a starred dm is in starred and not in direct", async () => {
    const { store } = await loaded();
    const list = store.getList();
    expect(ids(list.direct)).not.toContain(id(20));
  });

  it("gives rows with exactly the documented keys, and the other person of a dm", async () => {
    const { store } = await loaded();
    const list = store.getList();
    const dm = list.starred.find((r) => r.id === id(20))!;
    expect(Object.keys(dm).sort()).toEqual(
      [
        "hasMention",
        "id",
        "isGeneral",
        "isMuted",
        "isPrivate",
        "isStarred",
        "kind",
        "name",
        "notificationLevel",
        "otherPersonId",
        "unreadCount",
      ].sort(),
    );
    expect(dm).toMatchObject({
      name: "Alex Phạm",
      otherPersonId: id(2),
      kind: "dm",
    });
    expect(list.channels[0]!.otherPersonId).toBeNull();
    expect(list.direct.find((r) => r.id === id(22))!.otherPersonId).toBeNull();
    expect(list.channels.find((r) => r.id === id(12))).toMatchObject({
      isPrivate: true,
      isMuted: true,
      notificationLevel: "none",
    });
  });

  it("keeps a dm of a deactivated person in direct, with otherPersonId set", async () => {
    const { store } = await loaded();
    const row = store.getList().direct.find((r) => r.id === id(21))!;
    expect(row.otherPersonId).toBe(id(4));
    expect(row.name).toBe("Dee");
  });

  it("gives isEmpty true and three empty arrays for a query or a filter that matches nothing", async () => {
    const { store } = await loaded();
    for (const options of [
      { query: "zzz" },
      { filter: "unread" as const },
      { filter: "mentions" as const },
    ]) {
      const list = store.getList(options);
      expect(list).toEqual({
        starred: [],
        channels: [],
        direct: [],
        isEmpty: true,
      });
    }
  });

  it("searches by name, ignoring case and diacritics, and trims the query", async () => {
    const { store } = await loaded();
    expect(ids(store.getList({ query: "  LAUNCH " }).starred)).toEqual([
      id(11),
    ]);
    expect(ids(store.getList({ query: "pham" }).starred)).toEqual([id(20)]);
    expect(ids(store.getList({ query: "thu hoang" }).direct)).toEqual([id(22)]);
  });
});

describe("filters and the unread slot (R20)", () => {
  it("keeps the three filters by the records of the slot", async () => {
    const { store } = await loaded();
    store.setUnread(id(10), { count: 2, mention: false });
    store.setUnread(id(11), { count: 0, mention: false });
    store.setUnread(id(22), { count: 0, mention: true });
    const all = [
      ...ids(store.getList().starred),
      ...ids(store.getList().channels),
      ...ids(store.getList().direct),
    ];
    expect(all).toHaveLength(6);
    const flat = (filter: "unread" | "mentions") => {
      const l = store.getList({ filter });
      return [...ids(l.starred), ...ids(l.channels), ...ids(l.direct)].sort();
    };
    expect(flat("unread")).toEqual([id(10)]);
    expect(flat("mentions")).toEqual([id(22)]);
  });

  it("without records unread and mentions keep nothing", async () => {
    const { store } = await loaded();
    expect(store.getList({ filter: "unread" }).isEmpty).toBe(true);
    expect(store.getList({ filter: "mentions" }).isEmpty).toBe(true);
  });

  it("a muted conversation with unread messages is kept by unread, and the row holds the raw count and mute", async () => {
    const { store } = await loaded();
    store.setUnread(id(12), { count: 3, mention: false }); // muted secret-plan
    const list = store.getList({ filter: "unread" });
    expect(ids(list.channels)).toEqual([id(12)]);
    expect(list.channels[0]).toMatchObject({
      unreadCount: 3,
      isMuted: true,
      hasMention: false,
    });
  });

  it("clearUnread removes a record, and reset empties the slot", async () => {
    const { store } = await loaded();
    store.setUnread(id(10), { count: 2, mention: true });
    store.clearUnread(id(10));
    expect(store.getState().unread).toEqual({});
    store.setUnread(id(10), { count: 1, mention: false });
    store.reset();
    expect(store.getState().unread).toEqual({});
  });

  it("a refresh drops the record of a conversation the answer no longer lists and keeps the others", async () => {
    const { fake, store } = await loaded();
    store.setUnread(id(10), { count: 2, mention: false });
    store.setUnread(id(12), { count: 1, mention: false });
    fake.answer(
      "bootstrap",
      body(
        (b) =>
          (b.conversations = b.conversations.filter((c) => c.id !== id(12))),
      ),
    );
    await store.refresh();
    expect(Object.keys(store.getState().unread)).toEqual([id(10)]);
  });

  it("setUnread with an equal record calls no listener", async () => {
    const { store } = await loaded();
    store.setUnread(id(10), { count: 2, mention: false });
    let calls = 0;
    store.subscribe(() => calls++);
    store.setUnread(id(10), { count: 2, mention: false });
    store.clearUnread(id(99));
    expect(calls).toBe(0);
  });
});

describe("stable results (R22)", () => {
  it("returns the same object for equal arguments and no change, and for two argument sets alternately", async () => {
    const { store } = await loaded();
    const a = store.getList();
    const b = store.getList({ query: "pro" });
    expect(store.getList()).toBe(a);
    expect(store.getList({ query: "pro", filter: "all" })).toBe(b);
    expect(store.getList()).toBe(a);
    expect(store.getList({ query: "pro" })).toBe(b);
  });

  it("returns a new object after a change that touches what it reads, and the same one after a change that only sets error", async () => {
    const { fake, store } = await loaded();
    const list = store.getList();
    store.setUnread(id(10), { count: 1, mention: false });
    const afterUnread = store.getList();
    expect(afterUnread).not.toBe(list);
    fake.answer("bootstrap", new Error("offline"));
    await store.refresh(); // sets error and isRefreshing, nothing else
    expect(store.getState().error).not.toBeNull();
    expect(store.getList()).toBe(afterUnread);
  });

  it("returns the held value for the lookups, the same reference until a refresh replaces what they read", async () => {
    const { fake, store } = await loaded();
    const people = store.getPeople();
    const user = store.getUser();
    const workspace = store.getWorkspace();
    const entry = store.getConversation(id(10));
    store.setUnread(id(10), { count: 1, mention: false });
    fake.answer("bootstrap", new Error("x"));
    await store.refresh();
    expect(store.getPeople()).toBe(people);
    expect(store.getUser()).toBe(user);
    expect(store.getWorkspace()).toBe(workspace);
    expect(store.getConversation(id(10))).toBe(entry);
    expect(store.getPerson(id(2))).toBe(store.getPerson(id(2)));
    fake.answer("bootstrap", body());
    await store.refresh();
    expect(store.getPeople()).not.toBe(people);
  });

  it("forgets the argument sets at every change that touches conversations, people or the slot", async () => {
    const { store } = await loaded();
    const first = store.getList({ query: "a" });
    for (const q of ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k"])
      store.getList({ query: q });
    store.setUnread(id(10), { count: 1, mention: false });
    expect(store.getList({ query: "a" })).not.toBe(first);
  });
});

describe("lookups (R23)", () => {
  it("answers each lookup from the state, with no request", async () => {
    const { fake, store } = await loaded();
    expect(store.getConversation(id(11))).toMatchObject({
      name: "project-launch",
    });
    expect(store.getConversation(id(99))).toBeUndefined();
    expect(store.hasConversation(id(11))).toBe(true);
    expect(store.hasConversation(id(99))).toBe(false);
    expect(store.getGeneralId()).toBe(id(10));
    expect(store.getPerson(id(2))).toEqual({
      id: id(2),
      displayName: "Alex Phạm",
      role: "member",
      status: "active",
    });
    expect(store.getPerson(id(4))).toMatchObject({ status: "deactivated" });
    expect(store.getPerson(id(99))).toBeUndefined();
    expect(store.getPeople().map((p) => p.id)).toEqual([
      id(1),
      id(2),
      id(3),
      id(4),
    ]);
    expect(store.getUser()?.id).toBe(id(1));
    expect(store.getWorkspace()?.name).toBe("Acme");
    expect(store.getEventNumber()).toBe(41);
    expect(fake.count("bootstrap")).toBe(1);
  });

  it("counts the members: a dm and a group by memberIds, a channel by its held detail", async () => {
    const { fake, store } = await loaded((b) => {
      b.conversations.push({
        id: id(30),
        kind: "group_dm",
        name: null,
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: "all",
        isMuted: false,
        isStarred: false,
        memberIds: Array.from({ length: 8 }, (_, i) => id(100 + i)),
      });
    });
    expect(store.getMemberCount(id(30))).toBe(8);
    expect(store.getMemberCount(id(20))).toBe(2);
    expect(store.getMemberCount(id(11))).toBeUndefined();
    fake.answer("channels.get", {
      channel: { ...detailBody(11), memberCount: 7 },
    });
    await store.readChannel(id(11));
    expect(store.getMemberCount(id(11))).toBe(7);
  });

  it("getGeneralId is null when no entry is general", async () => {
    const { store } = await loaded(
      (b) => (b.conversations = b.conversations.slice(1)),
    );
    expect(store.getGeneralId()).toBeNull();
  });
});

describe("names", () => {
  it("getConversationName returns the name a row shows, and an empty text for an unknown id", async () => {
    const { store } = await loaded();
    expect(store.getConversationName(id(11))).toBe("project-launch");
    expect(store.getConversationName(id(20))).toBe("Alex Phạm");
    expect(store.getConversationName(id(22))).toBe("Alex Phạm, Thu Hoàng");
    expect(store.getConversationName(id(99))).toBe("");
  });
});
