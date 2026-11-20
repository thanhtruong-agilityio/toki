import { describe, expect, test, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { accountDetail } from "../../src/account/account-detail";

const t = vi.fn((key: string) => `<${key}>`);

describe("accountDetail (R2)", () => {
  test.each([
    ["member", "<common.role.member>"],
    ["admin", "<common.role.admin>"],
    ["owner", undefined],
    ["", undefined],
    [undefined, undefined],
    [null, undefined],
  ])("role %j gives %j", (role, expected) => {
    expect(accountDetail({ role } as never, t as never)).toBe(expected);
  });

  test("the word Owner is nowhere in the source of the folder", () => {
    const dir = join(__dirname, "../../src/account");
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) =>
        statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
      );
    for (const file of walk(dir)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/owner/i);
    }
  });
});
