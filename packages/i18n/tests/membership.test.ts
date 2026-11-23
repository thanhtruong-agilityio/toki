import { describe, expect, it } from "vitest";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { createTranslator } from "../src/translate";

// A copy of Table T of the TOKI-100 spec: key, English, Vietnamese (R3).
const tableT: Array<[string, string, string]> = [
  ["membership.add.button", "Add people", "Thêm người"],
  ["membership.add.title", "Add people to #{name}", "Thêm người vào #{name}"],
  ["membership.add.confirm", "Add", "Thêm"],
  [
    "membership.add.nobody",
    "Everyone is already in this channel.",
    "Mọi người đều đã ở trong kênh này.",
  ],
  [
    "membership.add.limit",
    "You can add up to {count} people at once.",
    "Mỗi lần chỉ thêm được tối đa {count} người.",
  ],
  [
    "membership.add.error.inactive",
    "Some of these people can no longer be added.",
    "Một số người không thể thêm vào kênh nữa.",
  ],
  ["membership.remove.button", "Remove", "Gỡ"],
  [
    "membership.remove.label",
    "Remove {name} from this channel",
    "Gỡ {name} khỏi kênh này",
  ],
  ["membership.remove.title", "Remove this person?", "Gỡ người này khỏi kênh?"],
  [
    "membership.remove.description",
    "The person named below will no longer be a member of #{channel}.",
    "Người được nêu tên bên dưới sẽ không còn là thành viên của #{channel}.",
  ],
  [
    "membership.remove.publicNotice",
    "This channel is public, so the person can join again from Browse channels.",
    "Kênh này công khai nên người đó có thể tham gia lại từ mục Duyệt kênh.",
  ],
  [
    "membership.remove.privateNotice",
    "This channel is private, so a member will have to add the person back.",
    "Kênh này riêng tư nên một thành viên sẽ phải thêm người đó vào lại.",
  ],
  ["membership.remove.confirm", "Remove", "Gỡ"],
];

function flatten(value: unknown, prefix: string): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, `${prefix}.${k}`),
  );
}

describe("membership catalogue (TOKI-100 R3)", () => {
  it("holds exactly the 13 keys of Table T in both languages", () => {
    const keys = tableT.map(([key]) => key).sort();
    expect(keys).toHaveLength(13);
    for (const catalog of [en, viMessages]) {
      expect(
        flatten(
          (catalog as Record<string, unknown>).membership,
          "membership",
        ).sort(),
      ).toEqual(keys);
    }
  });

  it.each(tableT)(
    "%s reads the same as the table",
    (key, english, vietnamese) => {
      const enT = createTranslator("en") as (k: string, p?: object) => string;
      const viT = createTranslator("vi") as (k: string, p?: object) => string;
      const fill = (text: string) =>
        text
          .replace("{name}", "Lan")
          .replace("{channel}", "design")
          .replace("{count}", "200");
      const params = { name: "Lan", channel: "design", count: 200 };
      expect(enT(key, params)).toBe(fill(english));
      expect(viT(key, params)).toBe(fill(vietnamese));
    },
  );
});
