import { describe, expect, it } from "vitest";
import { translate, type MessageKey } from "./translate";
import type { Language } from "./languages";

// A copy of the table "First texts" of the spec (R15). A later ticket that adds a key to nav
// adds it here in the same change (TOKI-015 adds nav.mainLabel).
const NAV: ReadonlyArray<readonly [MessageKey, string, string]> = [
  ["nav.home", "Home", "Trang chủ"],
  ["nav.activity", "Activity", "Hoạt động"],
  ["nav.later", "Later", "Để sau"],
  ["nav.files", "Files", "Tệp"],
  ["nav.people", "People", "Mọi người"],
  ["nav.preferences", "Preferences", "Tùy chọn"],
  ["nav.more", "More", "Thêm"],
  ["nav.directMessages", "Direct messages", "Tin nhắn riêng"],
  ["nav.channels", "Channels", "Kênh"],
  ["nav.starred", "Starred", "Đã gắn sao"],
  ["nav.conversations", "Conversations", "Hội thoại"],
  ["nav.search", "Search", "Tìm kiếm"],
  ["nav.admin", "Admin", "Quản trị"],
];

describe("nav namespace (R4, R15)", () => {
  it("holds exactly the 13 keys of the table", () => {
    expect(NAV).toHaveLength(13);
  });

  it.each(NAV)(
    "%s reads the same in both languages as the table",
    (key, english, vietnamese) => {
      const texts: Record<Language, string> = {
        en: translate("en", key),
        vi: translate("vi", key),
      };
      expect(texts).toEqual({ en: english, vi: vietnamese });
    },
  );
});
