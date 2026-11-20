import type { StorageArea } from "@toki/platform";
import { describe, expect, test } from "vitest";
import {
  COLLAPSED_KEY,
  FILTER_KEY,
  readCollapsed,
  readFilter,
  readStateAvailable,
  writeCollapsed,
  writeFilter,
} from "../../src/conversation-list/device-memory";
import {
  LAST_VIEWED_KEY,
  readLastViewed,
  viewFallback,
  writeLastViewed,
} from "../../src/conversation-list/last-viewed";

function fakeStorage(refuse = false) {
  const data = new Map<string, string>();
  const area: StorageArea = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      if (refuse) return false;
      data.set(key, value);
      return true;
    },
    remove: (key) => void data.delete(key),
    clear: () => data.clear(),
  };
  return { area, data };
}

const ME = "me";
const stored = (userId: string, value: unknown) =>
  JSON.stringify({ userId, value });

describe("the remembered filter (R18)", () => {
  test("the keys are the ones of the spec and the state is not available yet", () => {
    expect(FILTER_KEY).toBe("conversationList.filter");
    expect(COLLAPSED_KEY).toBe("conversationList.collapsed");
    expect(readStateAvailable).toBe(false);
  });

  test("a written filter is read back as one JSON text with the person", () => {
    const { area, data } = fakeStorage();
    writeFilter(area, ME, "all");
    expect(JSON.parse(data.get(FILTER_KEY)!)).toEqual({
      userId: ME,
      value: "all",
    });
    expect(readFilter(area, ME)).toBe("all");
  });

  test("a missing key, bad JSON, an unknown value and another person give all", () => {
    const { area, data } = fakeStorage();
    expect(readFilter(area, ME, true)).toBe("all");
    data.set(FILTER_KEY, "{not json");
    expect(readFilter(area, ME, true)).toBe("all");
    data.set(FILTER_KEY, stored(ME, "starred"));
    expect(readFilter(area, ME, true)).toBe("all");
    data.set(FILTER_KEY, stored(ME, 3));
    expect(readFilter(area, ME, true)).toBe("all");
    data.set(FILTER_KEY, "null");
    expect(readFilter(area, ME, true)).toBe("all");
    data.set(FILTER_KEY, stored("someone-else", "unread"));
    expect(readFilter(area, ME, true)).toBe("all");
  });

  test("with the state unavailable a stored unread or mentions is not restored, but a press still writes", () => {
    const { area, data } = fakeStorage();
    data.set(FILTER_KEY, stored(ME, "unread"));
    expect(readFilter(area, ME)).toBe("all");
    data.set(FILTER_KEY, stored(ME, "mentions"));
    expect(readFilter(area, ME)).toBe("all");
    writeFilter(area, ME, "mentions");
    expect(JSON.parse(data.get(FILTER_KEY)!).value).toBe("mentions");
  });

  test("with the state available the stored values are restored as stored", () => {
    const { area, data } = fakeStorage();
    data.set(FILTER_KEY, stored(ME, "unread"));
    expect(readFilter(area, ME, true)).toBe("unread");
    data.set(FILTER_KEY, stored(ME, "mentions"));
    expect(readFilter(area, ME, true)).toBe("mentions");
  });

  test("a refusing storage does not throw", () => {
    const { area } = fakeStorage(true);
    expect(() => writeFilter(area, ME, "unread")).not.toThrow();
    expect(readFilter(area, ME, true)).toBe("all");
  });
});

describe("the remembered collapsed groups (R18)", () => {
  test("stored and read back", () => {
    const { area, data } = fakeStorage();
    writeCollapsed(area, ME, ["channels", "direct"]);
    expect(JSON.parse(data.get(COLLAPSED_KEY)!)).toEqual({
      userId: ME,
      value: ["channels", "direct"],
    });
    expect(readCollapsed(area, ME)).toEqual(["channels", "direct"]);
  });

  test("missing, bad JSON, not an array, an unknown id and another person give none", () => {
    const { area, data } = fakeStorage();
    expect(readCollapsed(area, ME)).toEqual([]);
    data.set(COLLAPSED_KEY, "{");
    expect(readCollapsed(area, ME)).toEqual([]);
    data.set(COLLAPSED_KEY, stored(ME, "channels"));
    expect(readCollapsed(area, ME)).toEqual([]);
    data.set(COLLAPSED_KEY, stored(ME, ["channels", "nope"]));
    expect(readCollapsed(area, ME)).toEqual([]);
    data.set(COLLAPSED_KEY, stored("other", ["channels"]));
    expect(readCollapsed(area, ME)).toEqual([]);
  });

  test("a refusing storage does not throw and reads none", () => {
    const { area } = fakeStorage(true);
    expect(() => writeCollapsed(area, ME, ["direct"])).not.toThrow();
    expect(readCollapsed(area, ME)).toEqual([]);
  });
});

describe("the last viewed conversation (R22)", () => {
  const store = (ids: string[], general: string | null = "general-id") => ({
    hasConversation: (id: string) => ids.includes(id),
    getGeneralId: () => general,
  });

  test("the key is the one of the spec", () => {
    expect(LAST_VIEWED_KEY).toBe("conversationList.lastViewed");
  });

  test("the stored id that is in the list is the fallback", () => {
    const { area } = fakeStorage();
    writeLastViewed(area, ME, "a");
    expect(readLastViewed(area, ME)).toBe("a");
    expect(viewFallback(area, ME, store(["a", "general-id"]))).toBe("a");
  });

  test("a stored id that is not in the list gives #general", () => {
    const { area } = fakeStorage();
    writeLastViewed(area, ME, "gone");
    expect(viewFallback(area, ME, store(["general-id"]))).toBe("general-id");
  });

  test("nothing stored gives #general", () => {
    const { area } = fakeStorage();
    expect(viewFallback(area, ME, store(["general-id"]))).toBe("general-id");
  });

  test("another person's value gives #general", () => {
    const { area, data } = fakeStorage();
    data.set(LAST_VIEWED_KEY, stored("other", "a"));
    expect(readLastViewed(area, ME)).toBeNull();
    expect(viewFallback(area, ME, store(["a", "general-id"]))).toBe(
      "general-id",
    );
  });

  test("a refusing storage leaves #general", () => {
    const { area } = fakeStorage(true);
    writeLastViewed(area, ME, "a");
    expect(viewFallback(area, ME, store(["a", "general-id"]))).toBe(
      "general-id",
    );
  });

  test("bad JSON and a value that is not a text give no id", () => {
    const { area, data } = fakeStorage();
    data.set(LAST_VIEWED_KEY, "{");
    expect(readLastViewed(area, ME)).toBeNull();
    data.set(LAST_VIEWED_KEY, stored(ME, 5));
    expect(readLastViewed(area, ME)).toBeNull();
  });

  test("with no #general id yet the fallback is null", () => {
    const { area } = fakeStorage();
    expect(viewFallback(area, ME, store([], null))).toBeNull();
  });
});
