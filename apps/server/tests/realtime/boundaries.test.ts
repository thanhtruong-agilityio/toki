import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "../source-files.js";

// What the source of the server may not do (TOKI-036 R24, R25), found by a
// search of apps/server/src. Each search is first shown to find a planted line.

const src = fileURLToPath(new URL("../../src", import.meta.url));
const files = sourceFiles(src, false).map(
  (path) => [relative(src, path), readFileSync(path, "utf8")] as const,
);

type Rule = {
  name: string;
  applies: (path: string) => boolean;
  pattern: RegExp;
  planted: [string, string];
};

const inRealtime = (path: string) => path.startsWith("modules/realtime/");
const inNewModule = (path: string) =>
  inRealtime(path) || path.startsWith("modules/messages/");

const rules: Rule[] = [
  {
    name: "only modules/realtime calls recordEvent or names appendEvent",
    applies: (path) => !inRealtime(path),
    pattern: /\brecordEvent\s*\(|\bappendEvent\b/,
    planted: ["modules/messages/send.ts", "await recordEvent(tx, input);"],
  },
  {
    // The first ticket that writes a message (TOKI-037) removes this rule.
    name: "no code of the server writes a row of messages",
    applies: () => true,
    pattern: /\.insert\(\s*messages\b|insert\s+into\s+"?messages\b/i,
    planted: ["bootstrap/x.ts", "await tx.insert(messages).values(row);"],
  },
  {
    // TOKI-037 and TOKI-038 add routes and remove this rule.
    name: "the two new modules register no route",
    applies: inNewModule,
    pattern: /\.(get|post|put|patch|delete)\(\s*["'`]\/|\.route\(/,
    planted: ["modules/realtime/routes.ts", 'app.get("/api/v1/events", h);'],
  },
  {
    name: "the two new modules import no table of another module",
    applies: inNewModule,
    pattern: /from\s+["']\.\.\/[a-z-]+\/schema\.js["']/,
    planted: [
      "modules/realtime/x.ts",
      'import { users } from "../members/schema.js";',
    ],
  },
];

const offenders = (rule: Rule, among: readonly (readonly [string, string])[]) =>
  among
    .filter(([path, text]) => rule.applies(path) && rule.pattern.test(text))
    .map(([path]) => path);

describe("the boundaries of the new modules (R24, R25)", () => {
  it("reads the source of the server", () => {
    const paths = files.map(([path]) => path);
    expect(paths).toContain("modules/realtime/record.ts");
    expect(paths).toContain("modules/messages/schema.ts");
    expect(paths).toContain("app.ts");
  });

  it.each(rules)("$name", (rule) => {
    expect(offenders(rule, [rule.planted])).toEqual([rule.planted[0]]);
    expect(offenders(rule, files)).toEqual([]);
  });
});
