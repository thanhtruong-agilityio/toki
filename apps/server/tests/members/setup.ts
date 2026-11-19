// Test-only: the auth harness plus the small calls the member tests share.
import type { InjectOptions } from "fastify";
import { createHarness } from "../auth/test-harness.js";

type Options = Parameters<typeof createHarness>[0];

export type MemberBody = {
  member: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
  };
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export async function createMemberHarness(options: Options = {}) {
  const h = await createHarness(options);

  // A person with a live session. Returns the id and the cookie header.
  async function person(email: string, values: Record<string, unknown> = {}) {
    const id = await h.addUser(email, values);
    const { secret } = await h.signIn(email);
    return { id, email, secret, headers: h.withCookie(secret) };
  }
  const admin = (email: string, values: Record<string, unknown> = {}) =>
    person(email, { role: "admin", ...values });

  const post = (
    who: { headers: Record<string, string> } | null,
    url: string,
    payload?: unknown,
    extra: Partial<InjectOptions> = {},
  ) =>
    h.call({
      method: "POST",
      url: `/api/v1${url}`,
      headers: { ...(who?.headers ?? {}), ...(extra.headers ?? {}) },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const get = (who: { headers: Record<string, string> } | null, url: string) =>
    h.call({
      method: "GET",
      url: `/api/v1${url}`,
      headers: who?.headers ?? {},
    });

  const body = (res: { body: string }) => JSON.parse(res.body) as MemberBody;
  const user = async (id: string) =>
    (await h.sql`select * from users where id = ${id}`)[0]!;
  const actions = () =>
    h.sql`select * from admin_actions order by created_at, id`;
  const liveSessions = async (id: string) =>
    (
      await h.sql`select id from sessions where user_id = ${id} and ended_at is null`
    ).map((r) => r.id as string);

  return { ...h, person, admin, post, get, body, user, actions, liveSessions };
}

export type MemberHarness = Awaited<ReturnType<typeof createMemberHarness>>;
