import { describe, expect, it } from "vitest";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { createTranslator } from "../src/translate";

// A copy of Table T of the TOKI-098 spec: key, English, Vietnamese (R19).
const tableT: Array<[string, string, string]> = [
  ["createChannel.open", "Create channel", "Tạo kênh"],
  ["createChannel.title", "Create channel", "Tạo kênh"],
  ["createChannel.name.label", "Name", "Tên"],
  [
    "createChannel.name.error.invalid",
    "Use only lowercase letters, digits and hyphens.",
    "Chỉ dùng chữ thường, chữ số và dấu gạch ngang.",
  ],
  [
    "createChannel.error.tooLong",
    "Use {count} characters or fewer.",
    "Tối đa {count} ký tự.",
  ],
  [
    "createChannel.name.error.taken",
    "A channel with this name already exists.",
    "Đã có kênh với tên này.",
  ],
  ["createChannel.private.label", "Private", "Riêng tư"],
  [
    "createChannel.private.hint",
    "Only its members can find it. This cannot be changed later.",
    "Chỉ thành viên mới tìm thấy kênh. Không thể đổi sau khi tạo.",
  ],
  ["createChannel.topic.label", "Topic (optional)", "Chủ đề (không bắt buộc)"],
  [
    "createChannel.people.label",
    "Add people (optional)",
    "Thêm người (không bắt buộc)",
  ],
  [
    "createChannel.people.limit",
    "You can add up to {count} people.",
    "Chỉ thêm được tối đa {count} người.",
  ],
  ["createChannel.submit", "Create", "Tạo"],
  [
    "createChannel.error.invalidMember",
    "Someone you chose can no longer be added. Check the list and try again.",
    "Có người đã chọn không thể thêm được nữa. Hãy kiểm tra danh sách rồi thử lại.",
  ],
];

// The texts of TOKI-034 Table T that the dialog uses by key. TOKI-098 adds them
// when TOKI-034 has not landed (first to land); the text is TOKI-034's.
const picker: Array<[string, string, string]> = [
  ["picker.search.label", "Search people", "Tìm người"],
  ["picker.chip.remove", "Remove {name}", "Bỏ {name}"],
  ["picker.empty", "No people match", "Không có ai khớp"],
];

function flatten(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, `${prefix}.${k}`),
  );
}

describe("createChannel catalogue (TOKI-098 R19)", () => {
  it("holds exactly the 13 keys of Table T in both languages", () => {
    const keys = tableT.map(([key]) => key).sort();
    expect(keys).toHaveLength(13);
    for (const catalog of [en, viMessages]) {
      expect(
        flatten(
          (catalog as Record<string, unknown>).createChannel,
          "createChannel",
        ).sort(),
      ).toEqual(keys);
    }
  });

  it.each([...tableT, ...picker])(
    "%s reads the same as the table",
    (key, english, vietnamese) => {
      const enT = createTranslator("en") as (k: string, p?: object) => string;
      const viT = createTranslator("vi") as (k: string, p?: object) => string;
      expect(enT(key)).toBe(english);
      expect(viT(key)).toBe(vietnamese);
    },
  );

  it("fills {count}", () => {
    const enT = createTranslator("en");
    expect(enT("createChannel.error.tooLong", { count: 80 })).toBe(
      "Use 80 characters or fewer.",
    );
  });
});
