import { describe, expect, it } from "vitest";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { createTranslator } from "../src/translate";

// A copy of Table T of the TOKI-034 spec: key, English, Vietnamese (R3).
// `browse.row.members` has plural forms and is checked apart.
const tableT: Array<[string, string, string]> = [
  ["common.close", "Close", "Đóng"],
  ["browse.title", "Browse channels", "Duyệt kênh"],
  ["browse.search.label", "Search channels", "Tìm kênh"],
  ["browse.row.join", "Join", "Tham gia"],
  ["browse.row.open", "Open", "Mở"],
  ["browse.row.private", "Private", "Riêng tư"],
  ["browse.row.archived", "Archived", "Đã lưu trữ"],
  ["browse.empty", "No channels match", "Không có kênh nào khớp"],
  ["browse.loading", "Loading channels", "Đang tải kênh"],
  [
    "browse.error.load",
    "Channels could not be loaded.",
    "Không tải được danh sách kênh.",
  ],
  ["browse.error.retry", "Try again", "Thử lại"],
  ["browse.joined", "Joined #{name}", "Đã tham gia #{name}"],
  ["picker.title", "New message", "Tin nhắn mới"],
  ["picker.search.label", "Search people", "Tìm người"],
  ["picker.chip.remove", "Remove {name}", "Bỏ {name}"],
  ["picker.start", "Start", "Bắt đầu"],
  ["picker.empty", "No people match", "Không có ai khớp"],
  [
    "picker.limit",
    "Up to {count} people, counting you",
    "Tối đa {count} người, tính cả bạn",
  ],
  [
    "picker.error.deactivated",
    "Some people are no longer active. They were removed from your choice.",
    "Một số người không còn hoạt động. Họ đã được bỏ khỏi lựa chọn của bạn.",
  ],
];

function flatten(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, `${prefix}.${k}`),
  );
}

type T = (k: string, p?: object) => string;

describe("browse and picker catalogues (TOKI-034 R3)", () => {
  it("holds the 12 browse keys (11 strings and the plural) and the 7 picker keys in both languages", () => {
    const browse = [
      ...tableT.filter(([k]) => k.startsWith("browse.")).map(([k]) => k),
      "browse.row.members",
    ].sort();
    const picker = tableT
      .filter(([k]) => k.startsWith("picker."))
      .map(([k]) => k)
      .sort();
    expect(browse).toHaveLength(12);
    expect(picker).toHaveLength(7);
    for (const catalog of [en, viMessages]) {
      const c = catalog as Record<string, unknown>;
      const plural = (keys: string[]) =>
        keys.map((k) => k.replace(/\.(one|other)$/, "")).filter(
          (k, i, all) => all.indexOf(k) === i,
        );
      expect(plural(flatten(c.browse, "browse")).sort()).toEqual(browse);
      expect(flatten(c.picker, "picker").sort()).toEqual(picker);
    }
  });

  it.each(tableT)("%s reads the same as the table", (key, english, vi) => {
    expect((createTranslator("en") as T)(key)).toBe(english);
    expect((createTranslator("vi") as T)(key)).toBe(vi);
  });

  it("members: singular and plural in English, one form in Vietnamese", () => {
    const enT = createTranslator("en") as T;
    const viT = createTranslator("vi") as T;
    expect(enT("browse.row.members", { count: 1 })).toBe("1 member");
    expect(enT("browse.row.members", { count: 25 })).toBe("25 members");
    expect(viT("browse.row.members", { count: 1 })).toBe("1 thành viên");
    expect(viT("browse.row.members", { count: 25 })).toBe("25 thành viên");
  });

  it("fills {name} and {count}", () => {
    const enT = createTranslator("en") as T;
    expect(enT("browse.joined", { name: "design" })).toBe("Joined #design");
    expect(enT("picker.limit", { count: 8 })).toBe(
      "Up to 8 people, counting you",
    );
  });
});
