// Test-only: signed-in people, calls with a session, a second connection on the
// database of the app under test, and the wait for a lock (TOKI-029).
import postgres, { type Sql } from "postgres";
import { uuidv7 } from "uuidv7";
import type { Harness } from "../auth/test-harness.js";

export type Person = { id: string; email: string; headers: { cookie: string } };

// A person with a row in `users` and a real session (the code flow).
export async function person(
  h: Harness,
  name: string,
  role: "member" | "admin" = "member",
  values: Record<string, unknown> = {},
): Promise<Person> {
  const email = `${name}@example.com`;
  const id = await h.addUser(email, { role, ...values });
  const { secret } = await h.signIn(email);
  return { id, email, headers: h.withCookie(secret) };
}

// A person with no session, for rows only (to be added, deactivated, ...).
export async function bystander(
  h: Harness,
  name: string,
  values: Record<string, unknown> = {},
): Promise<string> {
  return h.addUser(`${name}@example.com`, values);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;
export const jsonOf = (res: { body: string }): Json =>
  JSON.parse(res.body) as Json;

export function send(
  h: Harness,
  who: Person,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
) {
  return h.call({
    method,
    url,
    headers: who.headers,
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
}

export const newChannelId = () => uuidv7();

// A second connection to the database the app uses; the caller ends it.
export const secondConnection = (h: Harness): Sql =>
  postgres(h.config.database.url, { max: 1, onnotice: () => {} });

// Resolves when some connection of this database waits on a lock; no sleeping
// beyond the poll.
export async function waitForLock(sql: Sql, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [w] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'`;
    if (w!.n > 0) return;
    if (Date.now() > deadline) throw new Error("nothing ever waited");
    await new Promise((r) => setTimeout(r, 20));
  }
}

export const conversationRows = (sql: Sql, where = "true") =>
  sql.unsafe<Record<string, unknown>[]>(
    `select * from conversations where ${where} order by created_at, id`,
  );
export const memberRows = (sql: Sql, conversationId: string) =>
  sql<
    Record<string, unknown>[]
  >`select * from conversation_members where conversation_id = ${conversationId} order by user_id`;
