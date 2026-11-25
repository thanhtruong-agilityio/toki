import { mkdirSync, writeFileSync } from "node:fs";
import type { TestInfo } from "@playwright/test";
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { knownDifferences } from "../parity/known-differences";

// The result rows of the UI parity check and the report that lists them (TOKI-109 R4, R11). A
// check does not fail on a difference: it attaches a row, and this reporter writes the report.

export type RowStatus =
  "match" | "differs" | "known" | "stale-known" | "not-run";

export interface Row {
  kind: "token" | "screen";
  // The same on every run: a property with its combination, or a screen with look and width.
  name: string;
  status: RowStatus;
  detail: Record<string, unknown>;
  images?: string[];
}

export interface KnownDifference {
  id: string;
  reason: string;
  // The ticket that will fix it, or the word `accepted`.
  ticket: string;
}

export async function attachRow(info: TestInfo, row: Row): Promise<void> {
  await info.attach("parity-row", {
    body: JSON.stringify(row),
    contentType: "application/json",
  });
}

// R4: a difference with an entry becomes `known`; an entry that matches no difference is listed as
// no longer a difference.
export function applyKnown(rows: Row[], known: KnownDifference[]): Row[] {
  const byId = new Map(known.map((k) => [k.id, k]));
  const used = new Set<string>();
  const out = rows.map((row): Row => {
    const entry = row.status === "differs" ? byId.get(row.name) : undefined;
    if (!entry) return row;
    used.add(entry.id);
    return {
      ...row,
      status: "known",
      detail: { ...row.detail, reason: entry.reason, ticket: entry.ticket },
    };
  });
  for (const entry of known) {
    if (used.has(entry.id)) continue;
    out.push({
      kind: entry.id.startsWith("--") ? "token" : "screen",
      name: entry.id,
      status: "stale-known",
      detail: { reason: entry.reason, ticket: entry.ticket },
    });
  }
  return out;
}

const cell = (value: unknown): string =>
  (typeof value === "string" ? value : JSON.stringify(value)).replace(
    /\|/g,
    "\\|",
  );

const describe = (row: Row): string => {
  const parts = Object.entries(row.detail).map(
    ([key, value]) => `${key}: ${cell(value)}`,
  );
  if (row.images?.length) parts.push(`images: ${row.images.join(", ")}`);
  return parts.join("; ");
};

function table(rows: Row[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map(
    (row) => `| ${row.name} | ${row.kind} | ${describe(row)} |`,
  );
  return `| Name | Kind | Detail |\n| --- | --- | --- |\n${lines.join("\n")}\n`;
}

// R11: the same rows give the same text, in any order.
export function renderReport(rows: Row[]): { md: string; json: string } {
  const sorted = [...rows].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
  );
  const of = (status: RowStatus) => sorted.filter((r) => r.status === status);
  const summary = `checked ${sorted.length} · match ${of("match").length} · differs ${of("differs").length} · known ${of("known").length} · no longer a difference ${of("stale-known").length} · not run ${of("not-run").length}`;
  const sections: [string, Row[]][] = [
    ["Differences (new)", of("differs")],
    ["Known differences", of("known")],
    [
      "Known differences that are no longer a difference: remove the entry",
      of("stale-known"),
    ],
    ["Not run: needs seeded data", of("not-run")],
  ];
  const md = [
    "# UI parity report",
    "",
    summary,
    "",
    ...sections
      .filter(([, list]) => list.length > 0)
      .flatMap(([title, list]) => [`## ${title}`, "", table(list)]),
  ].join("\n");
  return { md, json: JSON.stringify({ summary, rows: sorted }, null, 2) };
}

export default class ParityReporter implements Reporter {
  private rows: Row[] = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const attachment of result.attachments) {
      if (attachment.name !== "parity-row" || !attachment.body) continue;
      this.rows.push(JSON.parse(attachment.body.toString()) as Row);
    }
  }

  onEnd(_result: FullResult): void {
    const dir = process.env.PARITY_OUT ?? "e2e/assets/parity";
    mkdirSync(dir, { recursive: true });
    const { md, json } = renderReport(applyKnown(this.rows, knownDifferences));
    writeFileSync(`${dir}/report.md`, md);
    writeFileSync(`${dir}/report.json`, json);
  }
}
