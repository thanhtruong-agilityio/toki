import { describe, expect, it } from "vitest";
import { deviceLabel } from "../../src/modules/auth/device-label.js";

// Invented headers only (TOKI-026 "Device kind and browser").
const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const EDGE_WIN = `${CHROME_WIN} Edg/130.0.0.0`;
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:132.0) Gecko/20100101 Firefox/132.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const CHROME_ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; Tab S9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const OPERA = `${CHROME_WIN} OPR/115.0.0.0`;
const CHROMEBOOK =
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const LINUX_FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

describe("deviceLabel (TOKI-026 R6)", () => {
  const cases: [string, string | null | undefined, string, string][] = [
    ["Chrome on Windows", CHROME_WIN, "desktop", "chrome"],
    ["Edge on Windows", EDGE_WIN, "desktop", "edge"],
    ["Firefox on a Mac", FIREFOX_MAC, "desktop", "firefox"],
    ["Safari on a Mac", SAFARI_MAC, "desktop", "safari"],
    ["Safari on an iPhone", SAFARI_IPHONE, "phone", "safari"],
    ["Chrome on iOS", CHROME_IOS, "phone", "chrome"],
    ["Safari on an iPad", SAFARI_IPAD, "tablet", "safari"],
    ["Chrome on an Android phone", CHROME_ANDROID_PHONE, "phone", "chrome"],
    ["Chrome on an Android tablet", CHROME_ANDROID_TABLET, "tablet", "chrome"],
    ["Opera is another browser", OPERA, "desktop", "other"],
    ["Chrome on a Chromebook", CHROMEBOOK, "desktop", "chrome"],
    ["Firefox on Linux", LINUX_FIREFOX, "desktop", "firefox"],
    [
      "an app with an unknown header",
      "TokiApp/1.0 (CFNetwork)",
      "unknown",
      "other",
    ],
    ["no value", undefined, "unknown", "unknown"],
    ["null", null, "unknown", "unknown"],
    ["an empty value", "", "unknown", "unknown"],
  ];

  it.each(cases)("%s", (_name, header, deviceKind, browser) => {
    expect(deviceLabel(header)).toEqual({ deviceKind, browser });
  });

  it("applies the browser rules in order: Edg/ wins over Chrome/", () => {
    expect(deviceLabel(EDGE_WIN).browser).toBe("edge");
  });

  it("reads Edge on Android and iOS", () => {
    expect(deviceLabel(`${CHROME_ANDROID_PHONE} EdgA/130.0.0.0`).browser).toBe(
      "edge",
    );
    expect(deviceLabel(`${SAFARI_IPHONE} EdgiOS/130.0.0.0`).browser).toBe(
      "edge",
    );
  });

  it("reads Firefox on iOS", () => {
    expect(deviceLabel(`${SAFARI_IPHONE} FxiOS/132.0`).browser).toBe("firefox");
  });

  it("needs Version/ for Safari: a bare Safari/ token is another browser", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15",
      ).browser,
    ).toBe("other");
  });

  it("reads a tablet that asks for the desktop site as desktop", () => {
    expect(deviceLabel(SAFARI_MAC).deviceKind).toBe("desktop");
  });
});
