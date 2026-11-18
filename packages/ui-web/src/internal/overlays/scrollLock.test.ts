import { afterEach, describe, expect, test } from "vitest";
import { lockScroll, unlockScroll } from "./scrollLock";

afterEach(() => {
  document.body.style.overflow = "";
});

describe("scroll lock (R14)", () => {
  test("the first lock sets hidden, the last unlock restores the old value", () => {
    document.body.style.overflow = "scroll";
    lockScroll();
    expect(document.body.style.overflow).toBe("hidden");
    lockScroll();
    unlockScroll();
    expect(document.body.style.overflow).toBe("hidden");
    unlockScroll();
    expect(document.body.style.overflow).toBe("scroll");
  });

  test("an empty value comes back empty", () => {
    lockScroll();
    unlockScroll();
    expect(document.body.style.overflow).toBe("");
  });

  test("an unlock with no lock changes nothing", () => {
    document.body.style.overflow = "auto";
    unlockScroll();
    expect(document.body.style.overflow).toBe("auto");
  });
});
