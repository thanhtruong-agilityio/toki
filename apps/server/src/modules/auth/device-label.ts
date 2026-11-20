import type { Browser, DeviceKind } from "@toki/shared";

// Turns the stored User-Agent into the device kind and the browser of a row of
// "Signed-in devices" (TOKI-026 R6, "Device kind and browser"). A pure function
// with no dependency: the first rule that matches wins.

function browserOf(ua: string): Browser {
  if (ua === "") return "unknown";
  if (/Edg\/|EdgA\/|EdgiOS\//.test(ua)) return "edge";
  if (/OPR\/|Opera/.test(ua)) return "other";
  if (/Firefox\/|FxiOS\//.test(ua)) return "firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "chrome";
  if (ua.includes("Safari/") && ua.includes("Version/")) return "safari";
  return "other";
}

function deviceKindOf(ua: string): DeviceKind {
  if (ua === "") return "unknown";
  if (ua.includes("iPad")) return "tablet";
  if (ua.includes("iPhone")) return "phone";
  if (ua.includes("Android")) return ua.includes("Mobile") ? "phone" : "tablet";
  if (/Windows|Macintosh|CrOS|X11|Linux/.test(ua)) return "desktop";
  return "unknown";
}

export function deviceLabel(userAgent: string | null | undefined): {
  deviceKind: DeviceKind;
  browser: Browser;
} {
  const ua = userAgent ?? "";
  return { deviceKind: deviceKindOf(ua), browser: browserOf(ua) };
}
