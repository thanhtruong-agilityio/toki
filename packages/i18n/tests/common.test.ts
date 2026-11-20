import { describe, expect, it } from "vitest";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { createTranslator } from "../src/translate";

// A copy of Table B of the TOKI-093 spec: key, English, Vietnamese (proposals, D-139).
const tableB: Array<[string, string, string]> = [
  ["common.undo", "Undo", "Hoàn tác"],
  ["common.today", "Today", "Hôm nay"],
  ["common.tomorrow", "Tomorrow", "Ngày mai"],
  ["common.yesterday", "Yesterday", "Hôm qua"],
  ["common.role.member", "Member", "Thành viên"],
  ["common.role.admin", "Admin", "Admin"],
  ["common.cancel", "Cancel", "Hủy"],
  [
    "common.discard.title",
    "Discard what you typed?",
    "Bỏ nội dung bạn đã nhập?",
  ],
  [
    "common.discard.message",
    'What you typed in "{name}" will be lost.',
    'Nội dung bạn đã nhập trong "{name}" sẽ bị mất.',
  ],
  ["common.discard.confirm", "Discard", "Bỏ"],
  ["common.discard.keep", "Keep editing", "Tiếp tục chỉnh sửa"],
  [
    "common.offline.blocked",
    "You are offline. Try again when the connection is back.",
    "Bạn đang ngoại tuyến. Hãy thử lại khi có kết nối.",
  ],
  [
    "common.offline.undoBlocked",
    "You are offline, so this was not undone.",
    "Bạn đang ngoại tuyến nên chưa hoàn tác được.",
  ],
  [
    "common.error.actionFailed",
    "That did not work. Try again.",
    "Không thực hiện được. Hãy thử lại.",
  ],
  [
    "common.error.undoFailed",
    "Could not undo. Try again.",
    "Không hoàn tác được. Hãy thử lại.",
  ],
];

function flatten(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, `${prefix}.${k}`),
  );
}

describe("common catalogue (TOKI-093 R24)", () => {
  it("holds exactly the keys of Table B and the five of TOKI-099 in both languages", () => {
    const keys = tableB.map(([key]) => key).sort();
    expect(
      flatten((en as Record<string, unknown>).common, "common").sort(),
    ).toEqual(keys);
    expect(
      flatten((viMessages as Record<string, unknown>).common, "common").sort(),
    ).toEqual(keys);
  });

  it.each(tableB)(
    "%s reads the same as Table B",
    (key, english, vietnamese) => {
      const params = { name: "{name}" };
      // `{name}` stays a placeholder when no parameter is given, so ask for the raw text.
      const enT = createTranslator("en") as (k: string, p?: object) => string;
      const viT = createTranslator("vi") as (k: string, p?: object) => string;
      const withName = key.endsWith("discard.message") ? params : undefined;
      expect(enT(key, withName)).toBe(english);
      expect(viT(key, withName)).toBe(vietnamese);
    },
  );
});
