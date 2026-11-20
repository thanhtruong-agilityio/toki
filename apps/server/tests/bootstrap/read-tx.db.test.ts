import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { getAccountById } from "../../src/modules/members/index.js";
import { inReadSnapshot } from "../../src/bootstrap/read-tx.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("inReadSnapshot (TOKI-031 R10, R14)", () => {
  it("opens one read-only repeatable-read transaction whose mode is in the begin statement", async () => {
    const id = await h.addUser("tx@example.com");
    const before = h.statementLog.length;
    const result = await inReadSnapshot(h.db, async (tx) => {
      const [iso] = await tx.execute<{ transaction_isolation: string }>(
        "show transaction_isolation" as never,
      );
      const [ro] = await tx.execute<{ transaction_read_only: string }>(
        "show transaction_read_only" as never,
      );
      const account = await getAccountById(tx, id);
      return { iso, ro, account };
    });
    expect(result.account?.id).toBe(id);
    expect(result.iso).toEqual({ transaction_isolation: "repeatable read" });
    expect(result.ro).toEqual({ transaction_read_only: "on" });

    const mine = h.statementLog.slice(before);
    const connection = mine[0]!.connection;
    expect(new Set(mine.map((s) => s.connection))).toEqual(new Set([connection]));
    expect(mine[0]!.query.toLowerCase()).toBe(
      "begin isolation level repeatable read read only",
    );
    expect(mine.at(-1)!.query.toLowerCase()).toBe("commit");
    // begin, show, show, the account read, commit: no separate `set transaction`.
    expect(mine).toHaveLength(5);
    expect(mine.some((s) => /set transaction/i.test(s.query))).toBe(false);
  });

  it("refuses a write with SQLSTATE 25006", async () => {
    const id = await h.addUser("ro@example.com");
    await expect(
      inReadSnapshot(h.db, (tx) =>
        tx.execute(`update users set language = 'vi' where id = '${id}'` as never),
      ),
    ).rejects.toMatchObject({ code: "25006" });
  });
});
