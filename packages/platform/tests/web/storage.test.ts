import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StorageArea } from "../../src/types";
import { createStorage } from "../../src/web/storage";

let device: StorageArea;
let tab: StorageArea;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  ({ device, tab } = createStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each([
  ["device", () => device, () => localStorage, () => sessionStorage],
  ["tab", () => tab, () => sessionStorage, () => localStorage],
] as const)("storage.%s", (_name, area, own, other) => {
  test("set then get returns the value; unknown and removed keys give null (R6)", () => {
    expect(area().get("a.b")).toBeNull();
    expect(area().set("a.b", "v")).toBe(true);
    expect(area().get("a.b")).toBe("v");
    area().remove("a.b");
    expect(area().get("a.b")).toBeNull();
  });

  test("keeps its values in its own browser store under the toki: prefix (R7, R8)", () => {
    area().set("sign-in.step", "code");
    expect(own().getItem("toki:sign-in.step")).toBe("code");
    expect(other().getItem("toki:sign-in.step")).toBeNull();
  });

  test("clear removes only keys with the prefix (R8)", () => {
    area().set("a.b", "1");
    own().setItem("other-page", "keep");
    area().clear();
    expect(own().getItem("toki:a.b")).toBeNull();
    expect(own().getItem("other-page")).toBe("keep");
  });

  test("a second implementation reads what the first wrote (R7)", () => {
    area().set("a.b", "1");
    const again = createStorage();
    expect((_name === "device" ? again.device : again.tab).get("a.b")).toBe(
      "1",
    );
  });
});

describe("storage the browser refuses (R9)", () => {
  test("reading the storage object throws: get gives null, set gives false, the rest do nothing", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { device: d } = createStorage();
    expect(d.get("a.b")).toBeNull();
    expect(d.set("a.b", "v")).toBe(false);
    expect(() => d.remove("a.b")).not.toThrow();
    expect(() => d.clear()).not.toThrow();
  });

  test("a write over the quota gives false and a read still works", () => {
    const { device: d } = createStorage();
    d.set("a.b", "old");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(d.set("a.b", "v")).toBe(false);
    expect(d.get("a.b")).toBe("old");
  });

  test("get, remove and clear survive a store that throws on every call", () => {
    const { tab: t } = createStorage();
    t.set("a.b", "1");
    for (const method of ["getItem", "removeItem", "key"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    expect(t.get("a.b")).toBeNull();
    expect(() => t.remove("a.b")).not.toThrow();
    expect(() => t.clear()).not.toThrow();
  });
});
