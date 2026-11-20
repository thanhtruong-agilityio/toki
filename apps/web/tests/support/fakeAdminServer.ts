import type { ChannelSummary, MemberRow } from "@toki/shared";
import { vi } from "vitest";

// A small in-memory model of the server's list routes, used as the global `fetch` of a test so the
// real API client runs (TOKI-025 Testing). It applies the same rules as TOKI-024 R21 to R25 for
// `search`, `status`, `counts` and `limit`, so a test of the chips is a real one. Fake data only.

export type FakeMember = MemberRow;

const INVITATION = {
  id: "inv",
  role: "member" as const,
  state: "pending" as const,
  mailStatus: "sent" as const,
  invitedBy: { id: "u-admin", displayName: "Lan" },
  createdAt: "2026-01-02T03:04:05.000Z",
  sentAt: "2026-01-02T03:04:06.000Z",
  expiresAt: "2026-01-09T03:04:05.000Z",
};

export function person(over: Partial<FakeMember> & { n?: number } = {}) {
  const { n = 1, ...rest } = over;
  const id = `u-${String(n).padStart(3, "0")}`;
  return {
    kind: "account",
    userId: id,
    email: `member${String(n).padStart(3, "0")}@example.com`,
    displayName: `Member ${String(n).padStart(3, "0")}`,
    role: "member",
    status: "active",
    lastActiveAt: "2026-01-03T10:00:00.000Z",
    invitation: null,
    ...rest,
  } satisfies FakeMember;
}

export function invitation(
  over: Partial<FakeMember> & {
    n?: number;
    mailStatus?: "sent" | "failed";
  } = {},
) {
  const { n = 1, mailStatus = "sent", ...rest } = over;
  const status = rest.status ?? "invited";
  return {
    kind: "invitation",
    userId: null,
    email: `invitee${String(n).padStart(3, "0")}@example.com`,
    displayName: null,
    role: "member",
    status,
    lastActiveAt: null,
    invitation: {
      ...INVITATION,
      id: `inv-${String(n).padStart(3, "0")}`,
      mailStatus,
      state: status === "expired" ? "expired" : "pending",
    },
    ...rest,
  } satisfies FakeMember;
}

// `count` active Members named "Member 001", "Member 002" ... in the server's order (by name).
export function manyMembers(count: number): FakeMember[] {
  return Array.from({ length: count }, (_, i) => person({ n: i + 1 }));
}

export function channel(n: number, over: Partial<ChannelSummary> = {}) {
  return {
    id: `c-${String(n).padStart(3, "0")}`,
    name: `channel-${String(n).padStart(3, "0")}`,
    topic: null,
    isPrivate: false,
    isGeneral: false,
    archived: false,
    memberCount: n,
    isMember: true,
    ...over,
  } satisfies ChannelSummary;
}

export function manyChannels(count: number): ChannelSummary[] {
  return Array.from({ length: count }, (_, i) => channel(i + 1));
}

export type FakeCall = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
};

export type FakeAdminServerOptions = {
  members?: FakeMember[];
  channels?: ChannelSummary[];
  // Awaited before a call is answered: a test holds a request here and lets it go when it likes.
  gate?: (call: FakeCall) => Promise<void> | undefined;
  // A Response to answer a call with, instead of the model's answer; an Error is thrown, which the
  // client sees as a network error. Asked when the call arrives, before the model changes.
  fail?: (call: FakeCall) => Response | Error | undefined;
  // The result of a Resend, "invited" unless a test says otherwise.
  resendResult?: (invitationId: string) => "invited" | "mail_not_sent";
  // Answers a call even after its signal was aborted, like a server answer already on the wire, so
  // a test can prove that the page itself drops a late answer and does not rely on the abort.
  ignoreAbort?: boolean;
};

// Case and diacritics do not matter for the search (TOKI-024 R24, concern 2).
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export function createFakeAdminServer(options: FakeAdminServerOptions = {}) {
  const state = {
    members: options.members ?? [],
    channels: options.channels ?? [],
  };
  const calls: FakeCall[] = [];

  function listMembers(query: Record<string, string>) {
    const search = fold((query.search ?? "").trim());
    const matching = state.members.filter(
      (row) =>
        search === "" ||
        fold(row.displayName ?? "").includes(search) ||
        fold(row.email).includes(search),
    );
    // The totals follow the search and not the chip (TOKI-024 R24).
    const counts = { invited: 0, expired: 0, active: 0, deactivated: 0 };
    for (const row of matching) counts[row.status] += 1;
    const shown = query.status
      ? matching.filter((row) => row.status === query.status)
      : matching;
    const limit = Math.min(
      Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = query.cursor ? Number(query.cursor.replace("o:", "")) : 0;
    const page = shown.slice(offset, offset + limit);
    const next = offset + limit;
    return {
      members: page,
      counts,
      activeAdminCount: state.members.filter(
        (row) => row.status === "active" && row.role === "admin",
      ).length,
      nextCursor: next < shown.length ? `o:${next}` : null,
    };
  }

  function listChannels(query: Record<string, string>) {
    const offset = query.cursor ? Number(query.cursor.replace("o:", "")) : 0;
    const page = state.channels.slice(offset, offset + DEFAULT_LIMIT);
    const next = offset + DEFAULT_LIMIT;
    return {
      channels: page,
      nextCursor: next < state.channels.length ? `o:${next}` : null,
    };
  }

  const notFound = (code: string) =>
    json(404, { error: { code, message: "none" } });

  const accountOf = (row: FakeMember) => ({
    member: {
      id: row.userId,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      status: row.status === "deactivated" ? "deactivated" : "active",
    },
  });

  // The change routes of TOKI-024, applied to the model when the call arrives (R20 to R30).
  function post(call: FakeCall): Response | undefined {
    const invitationRoute = /^\/invitations\/([^/]+)\/(resend|revoke)$/.exec(
      call.path,
    );
    if (invitationRoute) {
      const id = decodeURIComponent(invitationRoute[1]!);
      const index = state.members.findIndex((row) => row.invitation?.id === id);
      const row = state.members[index];
      if (!row?.invitation) return notFound("invitation_not_found");
      if (invitationRoute[2] === "revoke") {
        state.members = state.members.filter((_, i) => i !== index);
        return json(200, {
          invitation: { ...row.invitation, state: "revoked" },
        });
      }
      const result = options.resendResult?.(id) ?? "invited";
      const invitation = {
        ...row.invitation,
        mailStatus:
          result === "invited" ? ("sent" as const) : ("failed" as const),
      };
      state.members = state.members.map((m, i) =>
        i === index ? { ...m, invitation } : m,
      );
      return json(200, { result, invitation });
    }
    const memberRoute =
      /^\/members\/([^/]+)\/(role|deactivate|reactivate)$/.exec(call.path);
    if (memberRoute) {
      const id = decodeURIComponent(memberRoute[1]!);
      const index = state.members.findIndex((row) => row.userId === id);
      const row = state.members[index];
      if (!row) return notFound("not_found");
      const body = call.body as { role?: "member" | "admin" } | undefined;
      const changed: FakeMember =
        memberRoute[2] === "role"
          ? { ...row, role: body?.role ?? row.role }
          : {
              ...row,
              status:
                memberRoute[2] === "deactivate" ? "deactivated" : "active",
            };
      state.members = state.members.map((m, i) => (i === index ? changed : m));
      return json(200, accountOf(changed));
    }
    return undefined;
  }

  const fetchImpl = async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, "http://localhost");
    const call: FakeCall = {
      method: init.method ?? "GET",
      path: url.pathname.replace(/^\/api\/v1/, ""),
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
    calls.push(call);
    const aborted = new Promise<never>((_, reject) => {
      if (options.ignoreAbort) return;
      init.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });
    // The answer is what the model holds when the call arrives, as on a real server: a call that
    // is held and let go later still carries the older data.
    const failure = options.fail?.(call);
    let answer: Response | undefined;
    if (failure === undefined) {
      if (call.method === "GET" && call.path === "/members")
        answer = json(200, listMembers(call.query));
      else if (call.method === "GET" && call.path === "/channels")
        answer = json(200, listChannels(call.query));
      else if (call.method === "POST") answer = post(call);
    }
    const gated = options.gate?.(call);
    if (gated) await Promise.race([gated, aborted]);
    if (!options.ignoreAbort && init.signal?.aborted)
      throw new DOMException("aborted", "AbortError");
    if (failure instanceof Error) throw failure;
    if (failure) return failure;
    return (
      answer ?? json(404, { error: { code: "not_found", message: "none" } })
    );
  };

  return {
    calls,
    fetch: vi.fn(fetchImpl),
    setMembers(members: FakeMember[]) {
      state.members = members;
    },
    setChannels(channels: ChannelSummary[]) {
      state.channels = channels;
    },
    install() {
      vi.stubGlobal("fetch", this.fetch);
      return this;
    },
  };
}

export type FakeAdminServer = ReturnType<typeof createFakeAdminServer>;

// A deferred value: a test gives it to `gate` and calls `release` when the answer may go.
export function hold() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export const errorBody = (code: string) => ({
  error: { code, message: "m" },
});

// An error answer; `requestId` goes where the server puts it (details.requestId).
export const failWith = (status: number, code: string, requestId?: string) =>
  json(
    status,
    requestId === undefined
      ? errorBody(code)
      : { error: { code, message: "m", details: { requestId } } },
  );
