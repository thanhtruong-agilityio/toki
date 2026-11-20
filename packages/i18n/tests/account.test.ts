import { describe, expect, it } from "vitest";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { createTranslator } from "../src/translate";

// A copy of Table B of the TOKI-099 spec: key, English, Vietnamese (proposals,
// D-139). The two plural keys are checked below, with a count.
const tableB: Array<[string, string, string]> = [
  ["account.menu.label", "Your account menu", "Menu tài khoản"],
  ["account.signingOut", "Signing out…", "Đang đăng xuất…"],
  ["account.entry.signOut", "Sign out", "Đăng xuất"],
  ["account.devices.title", "Signed-in devices", "Thiết bị đã đăng nhập"],
  ["account.devices.thisDevice", "This device", "Thiết bị này"],
  ["account.devices.lastUsed", "Last used {time}", "Dùng lần cuối {time}"],
  ["account.devices.row.name", "{browser} · {device}", "{browser} · {device}"],
  [
    "account.devices.row.described",
    "{name} (last used {time})",
    "{name} (dùng lần cuối {time})",
  ],
  [
    "account.devices.row.position",
    "{description}, {n} of {count}",
    "{description}, thứ {n} trong {count}",
  ],
  ["account.devices.kind.desktop", "Desktop", "Máy tính"],
  ["account.devices.kind.phone", "Phone", "Điện thoại"],
  ["account.devices.kind.tablet", "Tablet", "Máy tính bảng"],
  ["account.devices.kind.unknown", "Unknown device", "Thiết bị không rõ"],
  ["account.devices.browser.chrome", "Chrome", "Chrome"],
  ["account.devices.browser.edge", "Edge", "Edge"],
  ["account.devices.browser.safari", "Safari", "Safari"],
  ["account.devices.browser.firefox", "Firefox", "Firefox"],
  ["account.devices.browser.otherBrowser", "Other browser", "Trình duyệt khác"],
  [
    "account.devices.browser.unknown",
    "Unknown browser",
    "Trình duyệt không rõ",
  ],
  ["account.devices.signOut", "Sign out", "Đăng xuất"],
  ["account.devices.signOutLabel", "Sign out {device}", "Đăng xuất {device}"],
  [
    "account.devices.signOutOthers",
    "Sign out all other devices",
    "Đăng xuất tất cả thiết bị khác",
  ],
  [
    "account.devices.noOthers",
    "No other devices are signed in.",
    "Không có thiết bị nào khác đang đăng nhập.",
  ],
  ["account.devices.loading", "Loading devices", "Đang tải thiết bị"],
  [
    "account.devices.loadError",
    "Could not load the devices.",
    "Không tải được danh sách thiết bị.",
  ],
  ["account.devices.retry", "Try again", "Thử lại"],
  [
    "account.devices.confirmOne.title",
    "Sign out this device?",
    "Đăng xuất thiết bị này?",
  ],
  [
    "account.devices.confirmOne.description",
    "It will need a new code to sign in again.",
    "Thiết bị này sẽ cần mã mới để đăng nhập lại.",
  ],
  [
    "account.devices.confirmAll.title",
    "Sign out all other devices?",
    "Đăng xuất tất cả thiết bị khác?",
  ],
];
const plural = [
  "account.devices.confirmAll.description",
  "account.devices.confirmAll.target",
];

function flatten(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  const entries = Object.entries(value as Record<string, unknown>);
  // A plural leaf is `{ one?, other }` of strings: it is one key.
  if (
    entries.length > 0 &&
    entries.every(
      ([k, v]) => (k === "one" || k === "other") && typeof v === "string",
    )
  ) {
    return [prefix];
  }
  return entries.flatMap(([k, v]) => flatten(v, `${prefix}.${k}`));
}

type T = (key: string, params?: object) => string;
const enT = createTranslator("en") as unknown as T;
const viT = createTranslator("vi") as unknown as T;

describe("account catalogue (TOKI-099 R22)", () => {
  it("holds exactly the 31 keys of Table B in both languages", () => {
    const keys = [...tableB.map(([key]) => key), ...plural].sort();
    expect(keys).toHaveLength(31);
    expect(
      flatten((en as Record<string, unknown>).account, "account").sort(),
    ).toEqual(keys);
    expect(
      flatten(
        (viMessages as Record<string, unknown>).account,
        "account",
      ).sort(),
    ).toEqual(keys);
  });

  it.each(tableB)(
    "%s reads the same as Table B",
    (key, english, vietnamese) => {
      const params = {
        time: "{time}",
        browser: "{browser}",
        device: "{device}",
        name: "{name}",
        description: "{description}",
        n: "{n}",
        count: "{count}",
      };
      expect(enT(key, params)).toBe(english);
      expect(viT(key, params)).toBe(vietnamese);
    },
  );

  it("confirmAll.description and target have one and other forms in English", () => {
    const d = "account.devices.confirmAll.description";
    const g = "account.devices.confirmAll.target";
    expect(enT(d, { count: 1 })).toBe(
      "1 other device will be signed out. This device stays signed in.",
    );
    expect(enT(d, { count: 3 })).toBe(
      "3 other devices will be signed out. This device stays signed in.",
    );
    expect(enT(g, { count: 1 })).toBe("1 other device");
    expect(enT(g, { count: 2 })).toBe("2 other devices");
    expect(viT(d, { count: 2 })).toBe(
      "2 thiết bị khác sẽ bị đăng xuất. Thiết bị này vẫn đăng nhập.",
    );
    expect(viT(g, { count: 1 })).toBe("1 thiết bị khác");
  });
});

describe("the five common keys of TOKI-099 R22", () => {
  it.each([
    ["common.today", "Today", "Hôm nay"],
    ["common.tomorrow", "Tomorrow", "Ngày mai"],
    ["common.yesterday", "Yesterday", "Hôm qua"],
    ["common.role.member", "Member", "Thành viên"],
    ["common.role.admin", "Admin", "Admin"],
  ])("%s", (key, english, vietnamese) => {
    expect(enT(key)).toBe(english);
    expect(viT(key)).toBe(vietnamese);
  });
});
