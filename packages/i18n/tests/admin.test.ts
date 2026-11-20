import { describe, expect, it } from "vitest";
import { isPluralText } from "../src/catalog";
import { en } from "../src/messages/en";
import { vi as viMessages } from "../src/messages/vi";
import { translate, type MessageKey } from "../src/translate";
import { PLAIN, PLURAL_KEY } from "./admin-table-a";

function flatten(value: unknown, prefix: string): string[] {
  if (typeof value === "string" || isPluralText(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, `${prefix}.${k}`),
  );
}

const keys = [...PLAIN.map(([key]) => key), PLURAL_KEY].sort();

describe("admin catalogue (TOKI-025 R28, R29)", () => {
  it("holds the 72 keys of Table A in both languages", () => {
    expect(keys).toHaveLength(72);
    expect(
      flatten((en as Record<string, unknown>).admin, "admin").sort(),
    ).toEqual(keys);
    expect(
      flatten((viMessages as Record<string, unknown>).admin, "admin").sort(),
    ).toEqual(keys);
  });

  it.each(PLAIN)("%s reads the same as Table A", (key, english, vietnamese) => {
    // `{name}` and the other placeholders stay as they are when no parameter is given.
    expect(translate("en", key as MessageKey)).toBe(english);
    expect(translate("vi", key as MessageKey)).toBe(vietnamese);
  });

  it("writes the channel member count with the plural forms of R29", () => {
    const key = PLURAL_KEY as MessageKey;
    expect(translate("en", key, { count: 0 })).toBe("0 members");
    expect(translate("en", key, { count: 1 })).toBe("1 member");
    expect(translate("en", key, { count: 2 })).toBe("2 members");
    expect(translate("vi", key, { count: 0 })).toBe("0 thành viên");
    expect(translate("vi", key, { count: 1 })).toBe("1 thành viên");
    expect(translate("vi", key, { count: 2 })).toBe("2 thành viên");
  });

  it("never calls the role quản trị viên (R28)", () => {
    // Only the namespaces of this page: signIn (TOKI-023) has its own words.
    const { admin, common } = viMessages as Record<string, unknown>;
    expect(JSON.stringify({ admin, common })).not.toContain("quản trị viên");
  });
});
