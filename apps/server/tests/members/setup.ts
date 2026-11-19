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
  results: Array<{
    email: string;
    result: string;
    invitation?: InvitationBody;
  }>;
  result: string;
  invitation: InvitationBody;
};

export type InvitationBody = {
  id: string;
  state: string;
  role: string;
  mailStatus: string;
  invitedBy: { id: string; displayName: string };
  createdAt: string;
  sentAt: string;
  expiresAt: string;
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

  // The invitation mails handed to the layer, oldest first.
  type InvitationMail = {
    to: string;
    code: string;
    workspaceName: string;
    inviterName: string;
    joinUrl: string;
  };
  const invitationMails = () =>
    h.mail.calls
      .filter((c) => c.operation === "sendInvitationMail")
      .map((c) => c.input as InvitationMail);
  const tokenOf = (mail: InvitationMail) => mail.joinUrl.split("#")[1]!;
  let keys = 0;
  const key = () => `key-${(keys += 1)}`;
  const invite = (
    who: { headers: Record<string, string> } | null,
    emails: unknown,
    options: { role?: unknown; key?: string | null } = {},
  ) =>
    post(
      who,
      "/invitations",
      { emails, ...(options.role === undefined ? {} : { role: options.role }) },
      options.key === null
        ? {}
        : { headers: { "idempotency-key": options.key ?? key() } },
    );
  const invitation = async (id: string) =>
    (await h.sql`select * from invitations where id = ${id}`)[0]!;
  const invitationsOf = (email: string) =>
    h.sql`select * from invitations where email = ${email} order by created_at, id`;

  return {
    ...h,
    person,
    admin,
    post,
    get,
    body,
    user,
    actions,
    liveSessions,
    invitationMails,
    tokenOf,
    key,
    invite,
    invitation,
    invitationsOf,
  };
}

export type MemberHarness = Awaited<ReturnType<typeof createMemberHarness>>;
