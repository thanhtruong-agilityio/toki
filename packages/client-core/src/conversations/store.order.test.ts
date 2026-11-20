import { describe, expect, it } from "vitest";
import { detailBody, id } from "../api/fixtures";
import { createConversationStore } from "./store";
import { body, deferred, fakeApi } from "./test-support";

async function loaded() {
  const fake = fakeApi();
  const store = createConversationStore({ api: fake.api });
  fake.answer("bootstrap", body());
  await store.load();
  return { fake, store };
}
const settings = (
  level: "all" | "mentions" | "none",
  muted: boolean,
  starred: boolean,
) => ({
  settings: { notificationLevel: level, isMuted: muted, isStarred: starred },
  changed: true,
});

describe("saveSettings numbering (R15)", () => {
  it("two calls for one id whose answers arrive in reverse order leave the values of the second", async () => {
    const { fake, store } = await loaded();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    fake.answer("conversations.saveSettings", first, second);
    const p1 = store.saveSettings(id(11), { isMuted: true });
    const p2 = store.saveSettings(id(11), {
      isMuted: false,
      notificationLevel: "none",
    });
    second.resolve(settings("none", false, true));
    await p2;
    first.resolve(settings("all", true, true));
    await p1;
    expect(store.getConversation(id(11))).toMatchObject({
      notificationLevel: "none",
      isMuted: false,
    });
  });
});

describe("answers that arrive after a later change (R26)", () => {
  it("a readChannel begun before a leave: the channel is not in the list and not in details", async () => {
    const { fake, store } = await loaded();
    const gate = deferred<unknown>();
    fake.answer("channels.get", gate);
    const read = store.readChannel(id(11));
    fake.answer("channels.leave", { changed: true, archived: false });
    await store.leaveChannel(id(11));
    gate.resolve({ channel: detailBody(11) });
    expect(await read).toEqual(detailBody(11)); // the resolved value is still the answer
    expect(store.hasConversation(id(11))).toBe(false);
    expect(store.getChannelDetail(id(11))).toBeUndefined();
  });

  it("a refresh begun before a leave keeps the channel out, and so for an archive", async () => {
    for (const command of ["leave", "archive"] as const) {
      const { fake, store } = await loaded();
      const gate = deferred<unknown>();
      fake.answer("bootstrap", gate);
      const refresh = store.refresh();
      if (command === "leave") {
        fake.answer("channels.leave", { changed: true, archived: false });
        await store.leaveChannel(id(11));
      } else {
        fake.answer("channels.archive", {
          channel: { ...detailBody(11), archived: true },
          changed: true,
        });
        await store.archiveChannel(id(11));
      }
      gate.resolve(body()); // still lists the channel
      await refresh;
      expect(store.hasConversation(id(11))).toBe(false);
    }
  });

  it("a joinChannel answered while a refresh runs whose answer lacks the channel: the entry stays", async () => {
    const { fake, store } = await loaded();
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const refresh = store.refresh();
    fake.answer("channels.join", { channel: detailBody(80), changed: true });
    await store.joinChannel(id(80));
    gate.resolve(body());
    await refresh;
    expect(store.hasConversation(id(80))).toBe(true);
    expect(store.getChannelDetail(id(80))).toBeDefined();
  });

  it("the same for createChannel and openDirect", async () => {
    const { fake, store } = await loaded();
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const refresh = store.refresh();
    fake.answer("channels.create", { channel: detailBody(81), created: true });
    fake.answer("directConversations.open", {
      conversation: {
        id: id(82),
        kind: "dm",
        name: null,
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: "all",
        isMuted: false,
        isStarred: false,
        memberIds: [id(1), id(3)],
      },
      created: true,
    });
    await store.createChannel({ id: id(81), name: "x" });
    await store.openDirect([id(3)]);
    gate.resolve(body());
    await refresh;
    expect(store.hasConversation(id(81))).toBe(true);
    expect(store.hasConversation(id(82))).toBe(true);
  });

  it("a refresh begun, then a command on another id: the answer replaces the entries of ids no command touched", async () => {
    const { fake, store } = await loaded();
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const refresh = store.refresh();
    fake.answer("channels.leave", { changed: true, archived: false });
    await store.leaveChannel(id(11));
    gate.resolve(
      body((b) => {
        (b.conversations[0] as { topic: string | null }).topic =
          "From the answer";
      }),
    );
    await refresh;
    expect(store.getConversation(id(10))).toMatchObject({
      topic: "From the answer",
    });
  });

  it("a refresh begun before a saveSettings keeps the saved values over its own entry, and drops the entry when its answer lacks the id", async () => {
    const { fake, store } = await loaded();
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const refresh = store.refresh();
    fake.answer(
      "conversations.saveSettings",
      settings("none", true, false),
      settings("all", true, true),
    );
    await store.saveSettings(id(11), { isMuted: true });
    await store.saveSettings(id(12), { isStarred: true });
    gate.resolve(
      body((b) => {
        b.conversations = b.conversations.filter((c) => c.id !== id(12)); // lacks id(12)
      }),
    );
    await refresh;
    expect(store.getConversation(id(11))).toMatchObject({
      notificationLevel: "none",
      isMuted: true,
      isStarred: false,
    });
    expect(store.hasConversation(id(12))).toBe(false);
  });

  it("a readChannel begun before a saveSettings still applies its detail, and a later detail keeps the saved values", async () => {
    const { fake, store } = await loaded();
    const gate = deferred<unknown>();
    fake.answer("channels.get", gate, { channel: detailBody(11) });
    const read = store.readChannel(id(11));
    fake.answer("conversations.saveSettings", settings("none", true, true));
    await store.saveSettings(id(11), { isMuted: true });
    gate.resolve({ channel: { ...detailBody(11), topic: "Fresh" } });
    await read;
    expect(store.getConversation(id(11))).toMatchObject({
      topic: "Fresh",
      notificationLevel: "none",
      isMuted: true,
    });
    await store.readChannel(id(11));
    expect(store.getConversation(id(11))).toMatchObject({
      notificationLevel: "none",
      isMuted: true,
      isStarred: true,
    });
  });
});
