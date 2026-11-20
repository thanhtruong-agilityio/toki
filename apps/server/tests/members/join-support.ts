// Test-only: makes invitations in the states the Join routes tell apart (TOKI-097).
import { INVITATION_TOKEN_PATTERN } from "@toki/shared";
import type { MemberHarness } from "./setup.js";

export type Admin = Awaited<ReturnType<MemberHarness["admin"]>>;

export type Made = { id: string; email: string; token: string; code: string };

// A pending invitation made through the Admin route, so the mail layer holds the
// link and the first code, as in real use.
export async function makeInvitation(
  h: MemberHarness,
  admin: Admin,
  email: string,
  options: { role?: "member" | "admin" } = {},
): Promise<Made> {
  const res = await h.invite(admin, [email], { role: options.role });
  if (res.statusCode !== 200) throw new Error(`invite failed: ${res.body}`);
  const sent = h
    .invitationMails()
    .filter((m) => m.to === email)
    .at(-1)!;
  const token = h.tokenOf(sent);
  if (!INVITATION_TOKEN_PATTERN.test(token)) throw new Error("bad token");
  const [row] = await h.invitationsOf(email);
  return { id: row!.id as string, email, token, code: sent.code };
}

export const lookup = (h: MemberHarness, token: unknown) =>
  h.post(null, "/invitations/lookup", { token });
export const resend = (h: MemberHarness, token: unknown) =>
  h.post(null, "/invitations/codes", { token });
export const accept = (
  h: MemberHarness,
  token: unknown,
  code: unknown,
  who: { headers: Record<string, string> } | null = null,
) => h.post(who, "/invitations/sessions", { token, code });

export type Body = {
  state?: string;
  codeExpiresInSeconds?: number;
  resendAfterSeconds?: number;
  expiresInSeconds?: number;
  generalConversationId?: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    language: string;
  };
  error: { code: string; message: string; details?: Record<string, number> };
};
export const json = (res: { body: string }) => JSON.parse(res.body) as Body;

export async function revoke(h: MemberHarness, admin: Admin, made: Made) {
  const res = await h.post(admin, `/invitations/${made.id}/revoke`);
  if (res.statusCode !== 200) throw new Error(`revoke failed: ${res.body}`);
}

export const markUsed = (h: MemberHarness, made: Made) =>
  h.sql`update invitations set used_at = ${new Date(h.clock.now())} where id = ${made.id}`;

// 7 days of the invitation and one second.
export const pastTheSevenDays = (h: MemberHarness) =>
  h.clock.advance(7 * 24 * 3600 * 1000 + 1000);

// The cookie of an answer: its name, value and attributes.
export function cookieOf(res: { headers: Record<string, unknown> }) {
  const header = res.headers["set-cookie"];
  const text = Array.isArray(header) ? header[0] : header;
  if (typeof text !== "string") return null;
  const [pair, ...attrs] = text.split(";").map((p) => p.trim());
  const [name, ...rest] = pair!.split("=");
  return { name: name!, value: rest.join("="), attrs, header: text };
}
