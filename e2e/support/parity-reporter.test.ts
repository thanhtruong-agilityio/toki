import { describe, expect, it } from "vitest";
import { applyKnown, renderReport, type Row } from "./parity-reporter";

const differs = (name: string, detail: Record<string, unknown> = {}): Row => ({
  kind: "token",
  name,
  status: "differs",
  detail,
});
const match = (name: string): Row => ({
  kind: "token",
  name,
  status: "match",
  detail: {},
});

describe("applyKnown (R4)", () => {
  it("moves a difference to known and carries the reason and the ticket", () => {
    const rows = applyKnown(
      [differs("--bg calm/teal/own"), match("--ink calm/teal/own")],
      [{ id: "--bg calm/teal/own", reason: "on purpose", ticket: "accepted" }],
    );
    const known = rows.find((r) => r.name === "--bg calm/teal/own");
    expect(known?.status).toBe("known");
    expect(known?.detail).toMatchObject({
      reason: "on purpose",
      ticket: "accepted",
    });
    expect(rows.find((r) => r.name === "--ink calm/teal/own")?.status).toBe(
      "match",
    );
  });

  it("lists an entry that matches no difference as no longer a difference", () => {
    const rows = applyKnown(
      [match("--bg calm/teal/own")],
      [{ id: "--gone", reason: "r", ticket: "TOKI-1" }],
    );
    expect(rows.filter((r) => r.status === "stale-known")).toEqual([
      expect.objectContaining({ name: "--gone", status: "stale-known" }),
    ]);
  });

  it("does not change a row when there is no entry", () => {
    const rows = [differs("--x")];
    expect(applyKnown(rows, [])).toEqual(rows);
  });
});

describe("renderReport (R11)", () => {
  const rows: Row[] = [
    match("a"),
    differs("b", { prototype: "1", app: "2" }),
    { kind: "screen", name: "s", status: "not-run", detail: {} },
    {
      kind: "token",
      name: "k",
      status: "known",
      detail: { reason: "r", ticket: "accepted" },
    },
    {
      kind: "token",
      name: "old",
      status: "stale-known",
      detail: { reason: "r", ticket: "t" },
    },
  ];

  it("starts with the counts", () => {
    const { md } = renderReport(rows);
    expect(md).toContain(
      "checked 5 · match 1 · differs 1 · known 1 · no longer a difference 1 · not run 1",
    );
  });

  it("lists each new difference with its values", () => {
    const { md } = renderReport(rows);
    expect(md).toMatch(/\| b \|.*1.*2/);
  });

  it("says what to do about an entry that is no longer a difference", () => {
    expect(renderReport(rows).md).toContain(
      "no longer a difference: remove the entry",
    );
  });

  it("gives the same text for the same rows in any order", () => {
    const a = renderReport(rows);
    const b = renderReport([...rows].reverse());
    expect(b.md).toBe(a.md);
    expect(b.json).toBe(a.json);
  });
});
