import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// TOKI-026 R23: the command needs no mail. The files and packages reached by static imports from its
// entry hold no file of the `mail` module and no mail package. `import type` counts too, to be safe.
const root = path.resolve(import.meta.dirname, "../../../..");
const entry = path.join(root, "apps/server/src/cli/emergency-link.ts");

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function resolveRelative(from: string, spec: string): string | null {
  const base = path.resolve(path.dirname(from), spec.replace(/\.js$/, ""));
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function walk(start: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const spec = (match[1] ?? match[2] ?? match[3])!;
      if (spec.startsWith(".")) {
        const next = resolveRelative(file, spec);
        if (next === null)
          throw new Error(`cannot resolve ${spec} from ${file}`);
        queue.push(next);
      } else if (!spec.startsWith("node:")) {
        packages.add(
          spec.startsWith("@")
            ? spec.split("/").slice(0, 2).join("/")
            : spec.split("/")[0]!,
        );
      }
    }
  }
  return { files: [...files], packages: [...packages] };
}

describe("the import graph of the emergency command (TOKI-026 R23)", () => {
  const graph = walk(entry);

  it("reaches the entry, the auth entry of the command and the narrow reads", () => {
    const rel = graph.files.map((f) => path.relative(root, f));
    expect(rel).toContain("apps/server/src/cli/emergency-link.ts");
    expect(rel).toContain("apps/server/src/modules/auth/cli.ts");
    expect(rel).toContain("apps/server/src/modules/members/cli.ts");
    // The index of `members` reaches the mail layer through its routes and invitations.
    expect(rel).not.toContain("apps/server/src/modules/members/index.ts");
    expect(rel).not.toContain("apps/server/src/modules/auth/index.ts");
  });

  it("reaches no file of the mail module and no file that reads the whole configuration", () => {
    const rel = graph.files.map((f) => path.relative(root, f));
    expect(rel.filter((f) => f.includes("modules/mail/"))).toEqual([]);
    expect(rel).not.toContain("apps/server/src/config.ts");
    expect(rel).not.toContain("apps/server/src/app.ts");
  });

  it("imports no mail package", () => {
    expect(graph.packages.filter((p) => /mail/i.test(p))).toEqual([]);
  });

  it.each([
    ["auth", ["issueEmergencyLink"]],
    ["members", ["findAccountForEmergencyLink"]],
  ])(
    "the cli entry of the %s module exports only what the command needs",
    (name, names) => {
      const text = readFileSync(
        path.join(root, `apps/server/src/modules/${name}/cli.ts`),
        "utf8",
      );
      const exported = [...text.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(
        (m) =>
          m[1]!
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
      );
      expect(exported).toEqual(names);
    },
  );

  it("the Commands section of CLAUDE.md has the documented form (R39)", () => {
    const text = readFileSync(path.join(root, "CLAUDE.md"), "utf8");
    expect(text).toContain("pnpm --silent emergency:link <email>");
  });
});
