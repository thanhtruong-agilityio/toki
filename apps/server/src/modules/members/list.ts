import {
  ErrorCodes,
  IdParamSchema,
  type MemberListQuery,
  type MemberListResponse,
  type MemberRow,
  type MemberStatus,
} from "@toki/shared";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { getLastUsedAtByUser } from "../auth/index.js";
import { toInvitation } from "./invitations.js";
import { invitations, users } from "./schema.js";

// The member list (R21 to R25): accounts and the unclosed invitations of
// people who have no account, in one order, with a keyset cursor.

// The text that is compared in a search (R24): Unicode form NFD, the
// combining marks U+0300 to U+036F removed, đ and Đ turned into d, lower
// case. The steps of `foldSearchText` (TOKI-032 R19), as one expression of
// built-in functions, used on the stored value and on the text of the query.
const fold = (value: SQL) =>
  sql`lower(replace(replace(regexp_replace(normalize(${value}, NFD), '[\\u0300-\\u036F]', '', 'g'), 'đ', 'd'), 'Đ', 'd'))`;

type Cursor = { key: string; id: string };

const badCursor = () =>
  new AppError(
    400,
    ErrorCodes.validationFailed,
    "The request failed validation.",
    { issues: [{ path: ["cursor"], code: "invalid_value" }] },
  );

const encodeCursor = (c: Cursor) =>
  Buffer.from(JSON.stringify([c.key, c.id])).toString("base64url");

function decodeCursor(text: string): Cursor {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    throw badCursor();
  }
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "string" ||
    !IdParamSchema.safeParse(value[1]).success
  ) {
    throw badCursor();
  }
  return { key: value[0], id: value[1] as string };
}

type PageRow = {
  kind: "account" | "invitation";
  id: string;
  email: string;
  display_name: string | null;
  role: "member" | "admin";
  status: MemberStatus;
  sort_key: string;
  invitation_id: string | null;
};

export async function listMembers(
  db: Db,
  input: { workspaceId: string; query: MemberListQuery; now: Date },
): Promise<MemberListResponse> {
  const { workspaceId, query, now } = input;
  const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
  const at = sql`${now.toISOString()}::timestamptz`;

  // One row for each account, and one for each unclosed invitation whose
  // address has no account. A deactivated person with an unclosed invitation
  // is an account row that carries the invitation (R22, concern 3). The sort
  // key is compared in byte order, so the order does not depend on the
  // database's collation (R23).
  const rows = sql`
    select 'account' as kind, u.id, u.email, u.display_name, u.role,
           u.status, lower(u.display_name) collate "C" as sort_key,
           i.id as invitation_id
    from users u
    left join invitations i
      on i.workspace_id = u.workspace_id and i.email = u.email
     and i.used_at is null and i.revoked_at is null
     and u.status = 'deactivated'
    where u.workspace_id = ${workspaceId}
    union all
    select 'invitation', i.id, i.email, null, i.role,
           case when i.expires_at <= ${at} then 'expired' else 'invited' end,
           lower(i.email) collate "C", i.id
    from invitations i
    where i.workspace_id = ${workspaceId}
      and i.used_at is null and i.revoked_at is null
      and not exists (
        select 1 from users u
        where u.workspace_id = i.workspace_id and u.email = i.email)`;
  const matches =
    query.search === undefined || query.search === ""
      ? sql`true`
      : sql`(position(${fold(sql`${query.search}::text`)} in ${fold(sql`coalesce(r.display_name, '')`)}) > 0
          or position(${fold(sql`${query.search}::text`)} in ${fold(sql`r.email`)}) > 0)`;

  const page = (await db.execute(sql`
    select r.* from (${rows}) r
    where ${matches}
      and ${query.status === undefined ? sql`true` : sql`r.status = ${query.status}`}
      and ${
        cursor === null
          ? sql`true`
          : sql`(r.sort_key, r.id) > (${cursor.key}::text collate "C", ${cursor.id}::uuid)`
      }
    order by r.sort_key, r.id
    limit ${query.limit + 1}`)) as unknown as PageRow[];
  const shown = page.slice(0, query.limit);
  const last = shown.at(-1);

  // `counts` follow the search and not the status filter, so a chip equals
  // the rows it shows (R24).
  const counted = (await db.execute(sql`
    select r.status, count(*)::int as n from (${rows}) r
    where ${matches} group by r.status`)) as unknown as Array<{
    status: MemberStatus;
    n: number;
  }>;
  const counts = { invited: 0, expired: 0, active: 0, deactivated: 0 };
  for (const c of counted) counts[c.status] = c.n;

  const [admins] = (await db.execute(sql`
    select count(*)::int as n from users
    where workspace_id = ${workspaceId} and role = 'admin'
      and status = 'active'`)) as unknown as Array<{ n: number }>;

  const invitationIds = shown.flatMap((r) =>
    r.invitation_id ? [r.invitation_id] : [],
  );
  const inviter = alias(users, "inviter");
  const found =
    invitationIds.length === 0
      ? []
      : await db
          .select({
            row: invitations,
            inviter: { id: inviter.id, displayName: inviter.displayName },
          })
          .from(invitations)
          .innerJoin(inviter, eq(inviter.id, invitations.invitedBy))
          .where(
            and(
              eq(invitations.workspaceId, workspaceId),
              inArray(invitations.id, invitationIds),
            ),
          );
  const invitationOf = new Map(
    found.map((f) => [f.row.id, toInvitation(f, now)]),
  );
  const lastUsed = await getLastUsedAtByUser(
    db,
    shown.flatMap((r) => (r.kind === "account" ? [r.id] : [])),
  );

  const members = shown.map((r): MemberRow => {
    const account = r.kind === "account";
    return {
      kind: r.kind,
      userId: account ? r.id : null,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      status: r.status,
      lastActiveAt: account
        ? (lastUsed.get(r.id)?.toISOString() ?? null)
        : null,
      invitation: r.invitation_id
        ? (invitationOf.get(r.invitation_id) ?? null)
        : null,
    };
  });
  return {
    members,
    counts,
    activeAdminCount: admins?.n ?? 0,
    nextCursor:
      page.length > query.limit && last
        ? encodeCursor({ key: last.sort_key, id: last.id })
        : null,
  };
}
