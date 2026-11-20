// Test-only: the few database writes the sign-in end-to-end tests make from the test process
// (e2e/sign-in-server). Lives here because `postgres` resolves from this package. Never imported by the
// server; fake addresses on example.com only.
import postgres, { type Sql } from "postgres";
import { insertUser } from "./test-rows.js";

export type E2eDb = {
  /** A member with a fresh address: each test makes its own, so no limit of one test reaches another. */
  addMember(email: string, values?: Record<string, unknown>): Promise<void>;
  /** The Deactivated status written to the account, as an Admin's action would leave it. */
  deactivate(email: string): Promise<void>;
  /** Makes the latest code request of an address old enough for a new one (the wait of 60 seconds). */
  skipResendWait(email: string): Promise<void>;
  close(): Promise<void>;
};

export function openE2eDb(url: string): E2eDb {
  const sql: Sql = postgres(url, { max: 2, onnotice: () => {} });
  return {
    async addMember(email, values = {}) {
      const [workspace] = await sql<
        { id: string }[]
      >`select id from workspaces`;
      await insertUser(sql, {
        workspace_id: workspace!.id,
        email,
        display_name: "Test Member",
        ...values,
      });
    },
    async deactivate(email) {
      await sql`update users set status = 'deactivated' where email = ${email}`;
    },
    async skipResendWait(email) {
      await sql`update login_codes set created_at = created_at - interval '2 minutes'
        where email = ${email}`;
    },
    close: () => sql.end({ timeout: 1 }),
  };
}
