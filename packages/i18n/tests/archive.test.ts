import { describe, expect, it } from "vitest";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { createTranslator } from "../src/translate";

// A copy of Table T of the TOKI-101 spec: key, English, Vietnamese (R3).
const tableT: Array<[string, string, string]> = [
  ["archive.button", "Archive channel", "Lưu trữ kênh"],
  ["archive.title", "Archive this channel?", "Lưu trữ kênh này?"],
  ["archive.confirm", "Archive", "Lưu trữ"],
  ["archive.done", "Archived #{name}", "Đã lưu trữ #{name}"],
  ["archive.label", "Archived", "Đã lưu trữ"],
  [
    "archive.notice",
    "This channel has been archived",
    "Kênh này đã được lưu trữ",
  ],
  ["archive.restore", "Restore", "Khôi phục"],
  ["archive.restoreNamed", "Restore #{name}", "Khôi phục #{name}"],
  ["archive.restoreTitle", "Restore this channel?", "Khôi phục kênh này?"],
  [
    "archive.restoreMessage",
    "It will come back to the list of every member of the channel.",
    "Kênh sẽ quay lại danh sách của mọi thành viên trong kênh.",
  ],
  ["archive.restoreConfirm", "Restore", "Khôi phục"],
  ["archive.restored", "Restored #{name}", "Đã khôi phục #{name}"],
];

const messageEn = {
  one: "It will leave everyone's list and nobody will be able to post in it. 1 member can still read its history.",
  many: "It will leave everyone's list and nobody will be able to post in it. 25 members can still read its history.",
};
const messageVi =
  "Kênh sẽ biến mất khỏi danh sách của mọi người và không ai gửi được tin nhắn trong đó. {count} thành viên vẫn đọc được lịch sử.";

type T = (k: string, p?: object) => string;

describe("archive catalogue (TOKI-101 R3, R22)", () => {
  it("holds the thirteen keys of Table T in both languages", () => {
    // `archive.message` is one key with plural forms, so flatten sees it as
    // three paths (en: one, other) or two (vi: other).
    const keys = [...tableT.map(([key]) => key), "archive.message"].sort();
    expect(keys).toHaveLength(13);
    for (const catalog of [en, viMessages]) {
      const own = (catalog as Record<string, unknown>).archive as Record<
        string,
        unknown
      >;
      expect(
        Object.keys(own)
          .map((k) => `archive.${k}`)
          .sort(),
      ).toEqual(keys);
    }
  });

  it.each(tableT)("%s reads the same as the table", (key, english, vi) => {
    const enT = createTranslator("en") as T;
    const viT = createTranslator("vi") as T;
    expect(enT(key, { name: "{name}" })).toBe(english);
    expect(viT(key, { name: "{name}" })).toBe(vi);
  });

  it("fills the name", () => {
    const enT = createTranslator("en") as T;
    expect(enT("archive.done", { name: "design" })).toBe("Archived #design");
  });

  it("gives the plural forms of the message (R22)", () => {
    const enT = createTranslator("en") as T;
    const viT = createTranslator("vi") as T;
    expect(enT("archive.message", { count: 1 })).toBe(messageEn.one);
    expect(enT("archive.message", { count: 25 })).toBe(messageEn.many);
    expect(viT("archive.message", { count: 25 })).toBe(
      messageVi.replace("{count}", "25"),
    );
  });
});
