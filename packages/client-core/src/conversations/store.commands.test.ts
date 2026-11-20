import { describe, expect, it } from "vitest";
import { bootstrapBody, detailBody, id, summaryBody } from "../api/fixtures";
import { createConversationStore } from "./store";
import { body, fakeApi, httpError } from "./test-support";

async function loaded() {
  const fake = fakeApi();
  const store = createConversationStore({ api: fake.api });
  fake.answer("bootstrap", body());
  await store.load();
  let calls = 0;
  store.subscribe(() => calls++);
  return { fake, store, calls: () => calls };
}
const settings = (
  notificationLevel: "all" | "mentions" | "none",
  isMuted: boolean,
  isStarred: boolean,
  changed = true,
) => ({ settings: { notificationLevel, isMuted, isStarred }, changed });
const dmEntry = (n: number, other: number) => ({
  id: id(n),
  kind: "dm" as const,
  name: null,
  topic: null,
  isPrivate: true,
  isGeneral: false,
  notificationLevel: "none" as const,
  isMuted: true,
  isStarred: false,
  memberIds: [id(1), id(other)],
});

describe("openDirect (R15, R13)", () => {
  it("stores the entry as it is, with its own three values, and resolves with { id, created }", async () => {
    const { fake, store, calls } = await loaded();
    fake.answer("directConversations.open", {
      conversation: dmEntry(30, 3),
      created: true,
    });
    expect(await store.openDirect([id(3)])).toEqual({
      id: id(30),
      created: true,
    });
    expect(store.getConversation(id(30))).toEqual(dmEntry(30, 3));
    expect(calls()).toBe(1);
  });

  it("replaces the held entry of a repeat with the answer's values", async () => {
    const { fake, store } = await loaded();
    fake.answer("directConversations.open", {
      conversation: dmEntry(20, 2),
      created: false,
    });
    expect(await store.openDirect([id(2)])).toEqual({
      id: id(20),
      created: false,
    });
    expect(store.getConversation(id(20))).toMatchObject({
      notificationLevel: "none",
      isMuted: true,
    });
  });

  it("on an error changes nothing, calls no listener and rejects", async () => {
    const { fake, store, calls } = await loaded();
    const before = store.getState();
    fake.answer("directConversations.open", httpError(409));
    await expect(store.openDirect([id(3)])).rejects.toMatchObject({
      status: 409,
    });
    expect(store.getState()).toBe(before);
    expect(calls()).toBe(0);
  });
});

describe("createChannel", () => {
  it("stores the entry and the detail with the defaults, and resolves with { id, created }", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.create", { channel: detailBody(40), created: true });
    expect(
      await store.createChannel({ id: id(40), name: "project-launch" }),
    ).toEqual({
      id: id(40),
      created: true,
    });
    expect(store.getConversation(id(40))).toMatchObject({
      notificationLevel: "mentions",
      isMuted: false,
      isStarred: false,
    });
    expect(store.getChannelDetail(id(40))).toEqual(detailBody(40));
  });

  it("a repeat (created false) changes nothing that was not already so", async () => {
    const { fake, store, calls } = await loaded();
    fake.answer(
      "channels.create",
      { channel: detailBody(40), created: true },
      { channel: detailBody(40), created: false },
    );
    await store.createChannel({ id: id(40), name: "x" });
    const after = calls();
    expect(await store.createChannel({ id: id(40), name: "x" })).toEqual({
      id: id(40),
      created: false,
    });
    expect(calls()).toBe(after);
  });
});

describe("joinChannel", () => {
  it("adds an entry with the defaults and keeps the detail", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.join", { channel: detailBody(41), changed: true });
    await store.joinChannel(id(41));
    expect(store.getConversation(id(41))).toMatchObject({
      notificationLevel: "mentions",
      isMuted: false,
      isStarred: false,
    });
    expect(store.getChannelDetail(id(41))).toEqual(detailBody(41));
  });

  it("with changed true, the given settings win over the defaults", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.join", { channel: detailBody(41), changed: true });
    await store.joinChannel(id(41), {
      notificationLevel: "all",
      isMuted: true,
    });
    expect(store.getConversation(id(41))).toMatchObject({
      notificationLevel: "all",
      isMuted: true,
      isStarred: false,
    });
    expect(fake.calls.at(-1)!.args).toEqual([
      id(41),
      { notificationLevel: "all", isMuted: true },
    ]);
  });

  it("with changed false the given settings are ignored: the held entry stays, an unheld one gets the defaults", async () => {
    const { fake, store } = await loaded();
    fake.answer(
      "channels.join",
      { channel: detailBody(11), changed: false },
      { channel: detailBody(55), changed: false },
    );
    await store.joinChannel(id(11), {
      isMuted: true,
      notificationLevel: "none",
    });
    expect(store.getConversation(id(11))).toMatchObject({
      notificationLevel: "all",
      isMuted: false,
      isStarred: true,
    });
    await store.joinChannel(id(55), { isMuted: true });
    expect(store.getConversation(id(55))).toMatchObject({
      notificationLevel: "mentions",
      isMuted: false,
    });
  });

  it("on an error changes nothing", async () => {
    const { fake, store, calls } = await loaded();
    const before = store.getState();
    fake.answer("channels.join", httpError(404));
    await expect(store.joinChannel(id(41))).rejects.toMatchObject({
      status: 404,
    });
    expect(store.getState()).toBe(before);
    expect(calls()).toBe(0);
  });
});

describe("leaveChannel, archiveChannel, editChannel", () => {
  it("leave removes the entry and the detail, also when changed is false", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.get", { channel: detailBody(11) });
    await store.readChannel(id(11));
    fake.answer("channels.leave", { changed: false, archived: false });
    await store.leaveChannel(id(11));
    expect(store.hasConversation(id(11))).toBe(false);
    expect(store.getChannelDetail(id(11))).toBeUndefined();
  });

  it("leave is harmless to repeat", async () => {
    const { fake, store } = await loaded();
    fake.answer(
      "channels.leave",
      { changed: true, archived: false },
      { changed: false, archived: false },
    );
    await store.leaveChannel(id(11));
    await store.leaveChannel(id(11));
    expect(store.hasConversation(id(11))).toBe(false);
  });

  it("archive removes the entry and keeps the detail with archived true", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.archive", {
      channel: { ...detailBody(11), archived: true },
      changed: true,
    });
    await store.archiveChannel(id(11));
    expect(store.hasConversation(id(11))).toBe(false);
    expect(store.getChannelDetail(id(11))).toMatchObject({ archived: true });
  });

  it("edit stores the entry with the new topic and the held three values, and the detail", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.update", {
      channel: { ...detailBody(11), topic: "New topic", description: "D" },
      changed: true,
    });
    await store.editChannel(id(11), { topic: "New topic" });
    expect(store.getConversation(id(11))).toMatchObject({
      topic: "New topic",
      notificationLevel: "all",
      isStarred: true,
    });
    expect(store.getChannelDetail(id(11))).toMatchObject({ description: "D" });
    expect(JSON.stringify(store.getConversation(id(11)))).not.toContain('"D"');
  });
});

describe("restoreChannel", () => {
  it("restores, adds the entry with the defaults, then refreshes: the entry takes the bootstrap values and the detail stays", async () => {
    const { fake, store, calls } = await loaded();
    const restored = detailBody(60);
    fake.answer("channels.restore", { channel: restored, changed: true });
    fake.answer(
      "bootstrap",
      body((b) => {
        b.conversations.push({
          ...(bootstrapBody().conversations[0] as object),
          id: id(60),
          name: "project-launch",
          notificationLevel: "none",
          isMuted: true,
          isStarred: true,
        } as never);
      }),
    );
    await store.restoreChannel(id(60));
    expect(fake.calls.map((c) => c.name).slice(-2)).toEqual([
      "channels.restore",
      "bootstrap",
    ]);
    expect(store.getConversation(id(60))).toMatchObject({
      notificationLevel: "none",
      isMuted: true,
      isStarred: true,
    });
    expect(store.getChannelDetail(id(60))).toEqual(restored);
    // The restore's own answer, the start of the refresh (isRefreshing) and its result.
    expect(calls()).toBe(3);
  });

  it("does not reject for a failed refresh: the entry keeps the defaults and the error is set", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.restore", { channel: detailBody(60), changed: true });
    fake.answer("bootstrap", httpError(500));
    await expect(store.restoreChannel(id(60))).resolves.toBeUndefined();
    expect(store.getConversation(id(60))).toMatchObject({
      notificationLevel: "mentions",
      isMuted: false,
    });
    expect(store.getState().error?.status).toBe(500);
    expect(store.getChannelDetail(id(60))).toBeDefined();
  });

  it("rejects when the restore request itself fails, and changes no state", async () => {
    const { fake, store } = await loaded();
    const before = store.getState();
    fake.answer("channels.restore", httpError(409));
    await expect(store.restoreChannel(id(60))).rejects.toMatchObject({
      status: 409,
    });
    expect(store.getState()).toBe(before);
  });
});

describe("saveSettings (R15)", () => {
  it("puts the answer's three values in a channel, a dm and a group entry, one listener call each", async () => {
    const { fake, store, calls } = await loaded();
    for (const target of [id(11), id(20), id(22)]) {
      fake.answer("conversations.saveSettings", settings("none", true, false));
      const before = calls();
      await expect(
        store.saveSettings(target, { isMuted: true }),
      ).resolves.toBeUndefined();
      expect(calls()).toBe(before + 1);
      expect(store.getConversation(target)).toMatchObject({
        notificationLevel: "none",
        isMuted: true,
        isStarred: false,
      });
    }
  });

  it("changes nothing for an id that is not held, and calls no listener", async () => {
    const { fake, store, calls } = await loaded();
    const before = store.getState();
    fake.answer("conversations.saveSettings", settings("all", true, true));
    await store.saveSettings(id(99), { isMuted: true });
    expect(store.getState()).toBe(before);
    expect(calls()).toBe(0);
  });

  it("calls no listener when the answer equals the held values", async () => {
    const { fake, store, calls } = await loaded();
    fake.answer(
      "conversations.saveSettings",
      settings("all", false, true, false),
    );
    await store.saveSettings(id(11), { isStarred: true });
    expect(calls()).toBe(0);
  });

  it("on an error changes nothing and rejects; a call with no key is sent and rejects with the server's 400", async () => {
    const { fake, store, calls } = await loaded();
    const before = store.getState();
    fake.answer(
      "conversations.saveSettings",
      httpError(400, "validation_failed"),
    );
    await expect(store.saveSettings(id(11), {})).rejects.toMatchObject({
      status: 400,
    });
    expect(fake.calls.at(-1)!.args).toEqual([id(11), {}]);
    expect(store.getState()).toBe(before);
    expect(calls()).toBe(0);
  });
});

describe("readChannel and details (R14)", () => {
  it("keeps the detail of an archived channel the person is a member of, and adds no entry", async () => {
    const { fake, store } = await loaded();
    const archived = { ...detailBody(70), archived: true };
    fake.answer("channels.get", { channel: archived });
    expect(await store.readChannel(id(70))).toEqual(archived);
    expect(store.getChannelDetail(id(70))).toEqual(archived);
    expect(store.hasConversation(id(70))).toBe(false);
  });

  it("keeps the summary of a public channel that is not joined, and adds no entry", async () => {
    const { fake, store } = await loaded();
    const stranger = { ...summaryBody(71), isMember: false };
    fake.answer("channels.get", { channel: stranger });
    await store.readChannel(id(71));
    expect(store.getChannelDetail(id(71))).toEqual(stranger);
    expect(store.hasConversation(id(71))).toBe(false);
  });

  it("removes a held entry when the later answer says the person is not a member", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.get", {
      channel: { ...summaryBody(11), isMember: false },
    });
    await store.readChannel(id(11));
    expect(store.hasConversation(id(11))).toBe(false);
  });

  it("adds an entry with the defaults for an active member detail", async () => {
    const { fake, store } = await loaded();
    fake.answer("channels.get", { channel: detailBody(72) });
    await store.readChannel(id(72));
    expect(store.getConversation(id(72))).toMatchObject({
      notificationLevel: "mentions",
      isMuted: false,
      isStarred: false,
    });
  });

  it("a held detail survives a refresh that agrees, and is dropped when the answer contradicts it", async () => {
    const { fake, store } = await loaded();
    const archived = { ...detailBody(70), archived: true };
    const joined = detailBody(11);
    const left = detailBody(73); // a member of an active channel the refresh no longer lists
    fake.answer(
      "channels.get",
      { channel: archived },
      { channel: joined },
      { channel: left },
      { channel: { ...summaryBody(12), isMember: false } },
    );
    await store.readChannel(id(70));
    await store.readChannel(id(11));
    await store.readChannel(id(73));
    await store.readChannel(id(12)); // says not a member, but the refresh lists it as joined
    fake.answer("bootstrap", body());
    await store.refresh();
    expect(store.getChannelDetail(id(70))).toEqual(archived); // stays
    expect(store.getChannelDetail(id(11))).toEqual(joined); // agrees
    expect(store.getChannelDetail(id(73))).toBeUndefined(); // no longer a member
    expect(store.getChannelDetail(id(12))).toBeUndefined(); // contradicted
  });
});

describe("every command: one listener call on success, none and a rejection on an error (R15)", () => {
  const cases: {
    name: string;
    answer: [string, unknown];
    run: (
      store: Awaited<ReturnType<typeof loaded>>["store"],
    ) => Promise<unknown>;
    error: string;
  }[] = [
    {
      name: "createChannel",
      answer: ["channels.create", { channel: detailBody(90), created: true }],
      run: (s) => s.createChannel({ id: id(90), name: "x" }),
      error: "channels.create",
    },
    {
      name: "leaveChannel",
      answer: ["channels.leave", { changed: true, archived: false }],
      run: (s) => s.leaveChannel(id(11)),
      error: "channels.leave",
    },
    {
      name: "editChannel",
      answer: [
        "channels.update",
        { channel: { ...detailBody(11), topic: "T2" }, changed: true },
      ],
      run: (s) => s.editChannel(id(11), { topic: "T2" }),
      error: "channels.update",
    },
    {
      name: "archiveChannel",
      answer: [
        "channels.archive",
        { channel: { ...detailBody(11), archived: true }, changed: true },
      ],
      run: (s) => s.archiveChannel(id(11)),
      error: "channels.archive",
    },
    {
      name: "readChannel",
      answer: ["channels.get", { channel: detailBody(91) }],
      run: (s) => s.readChannel(id(91)),
      error: "channels.get",
    },
    {
      name: "joinChannel",
      answer: ["channels.join", { channel: detailBody(92), changed: true }],
      run: (s) => s.joinChannel(id(92)),
      error: "channels.join",
    },
    {
      name: "restoreChannel",
      answer: ["channels.restore", { channel: detailBody(93), changed: true }],
      run: (s) => s.restoreChannel(id(93)),
      error: "channels.restore",
    },
  ];

  // restoreChannel makes three listener calls on success (its answer, the start
  // of its refresh, the refresh's result); the other commands make one.
  it.each(cases.filter((c) => c.name !== "restoreChannel"))(
    "$name: one listener call on success",
    async ({ answer, run }) => {
      const { fake, store, calls } = await loaded();
      fake.answer(answer[0], answer[1]);
      await run(store);
      expect(calls()).toBe(1);
    },
  );

  it.each(cases)(
    "$name: an error changes nothing, calls no listener and rejects",
    async ({ run, error }) => {
      const { fake, store, calls } = await loaded();
      const before = store.getState();
      fake.answer(error, httpError(500));
      await expect(run(store)).rejects.toMatchObject({ status: 500 });
      expect(store.getState()).toBe(before);
      expect(calls()).toBe(0);
    },
  );
});
