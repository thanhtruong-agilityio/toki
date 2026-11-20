import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IDEMPOTENCY_KEY_PATTERN } from "@toki/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeRole,
  deactivateMember,
  inviteMembers,
  listMembers,
  reactivateMember,
  resendInvitation,
  revokeInvitation,
} from "../../src/admin/adminApi";
import { newId } from "../../src/ids";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const INVITATION = {
  id: "inv-1",
  role: "member",
  state: "pending",
  mailStatus: "sent",
  invitedBy: { id: "u-1", displayName: "Lan" },
  createdAt: "2026-01-02T03:04:05.000Z",
  sentAt: "2026-01-02T03:04:06.000Z",
  expiresAt: "2026-01-09T03:04:05.000Z",
};

const LIST = {
  members: [
    {
      kind: "account",
      userId: "u-2",
      email: "minh@example.com",
      displayName: "Minh",
      role: "member",
      status: "active",
      lastActiveAt: "2026-01-03T10:00:00.000Z",
      invitation: null,
    },
    {
      kind: "invitation",
      userId: null,
      email: "sam@example.com",
      displayName: null,
      role: "member",
      status: "invited",
      lastActiveAt: null,
      invitation: INVITATION,
    },
    {
      kind: "account",
      userId: "u-3",
      email: "x@example.com",
      displayName: "X",
      role: "admin",
      status: "active",
      lastActiveAt: "not a date",
      invitation: { ...INVITATION, createdAt: "also not a date" },
    },
  ],
  counts: { invited: 1, expired: 0, active: 2, deactivated: 0 },
  activeAdminCount: 1,
  nextCursor: null,
};

const ACCOUNT = {
  member: {
    id: "u-2",
    email: "minh@example.com",
    displayName: "Minh",
    role: "admin",
    status: "active",
  },
};

let fetchMock: ReturnType<typeof vi.fn>;

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  const headers = new Headers(init.headers);
  return {
    url,
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
  };
}

beforeEach(() => {
  fetchMock = vi.fn(async () => json(200, {}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("listMembers (R5)", () => {
  it("asks GET /members and leaves an empty search and an unset status out", async () => {
    fetchMock.mockResolvedValue(json(200, LIST));
    await listMembers({ search: "", status: undefined });
    expect(lastCall()).toMatchObject({
      url: "/api/v1/members",
      method: "GET",
    });
  });

  it("sends search, status, limit and cursor when they are set", async () => {
    fetchMock.mockResolvedValue(json(200, LIST));
    await listMembers({
      search: "nguyen",
      status: "invited",
      limit: 75,
      cursor: "c1",
    });
    expect(lastCall().url).toBe(
      "/api/v1/members?search=nguyen&status=invited&limit=75&cursor=c1",
    );
  });

  it("gives lastActiveAt and the invitation dates as epoch milliseconds", async () => {
    fetchMock.mockResolvedValue(json(200, LIST));
    const answer = await listMembers({});
    const [active, invited] = answer.members;
    expect(active?.lastActiveAt).toBe(Date.parse("2026-01-03T10:00:00.000Z"));
    expect(invited?.lastActiveAt).toBeNull();
    expect(invited?.invitation?.createdAt).toBe(
      Date.parse("2026-01-02T03:04:05.000Z"),
    );
    expect(answer.counts).toEqual(LIST.counts);
    expect(answer.activeAdminCount).toBe(1);
    expect(answer.nextCursor).toBeNull();
  });

  it("gives null for a string that is not a date", async () => {
    fetchMock.mockResolvedValue(json(200, LIST));
    const answer = await listMembers({});
    const odd = answer.members[2];
    expect(odd?.lastActiveAt).toBeNull();
    expect(odd?.invitation?.createdAt).toBeNull();
  });

  it("passes the abort signal to the request", async () => {
    fetchMock.mockResolvedValue(json(200, LIST));
    const controller = new AbortController();
    await listMembers({}, controller.signal);
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("the other calls (R5)", () => {
  it("inviteMembers: POST /invitations with the body and the key header", async () => {
    fetchMock.mockResolvedValue(json(200, { results: [] }));
    await inviteMembers({ emails: ["sam@example.com"], role: "admin" }, "k-1");
    const call = lastCall();
    expect(call).toMatchObject({
      url: "/api/v1/invitations",
      method: "POST",
      body: { emails: ["sam@example.com"], role: "admin" },
    });
    expect(call.headers.get("Idempotency-Key")).toBe("k-1");
    expect(call.headers.get("Accept")).toBe("application/json");
  });

  it("resendInvitation: POST /invitations/:id/resend with the key and no body", async () => {
    fetchMock.mockResolvedValue(
      json(200, { result: "invited", invitation: INVITATION }),
    );
    const answer = await resendInvitation("inv-1", "k-2");
    const call = lastCall();
    expect(call).toMatchObject({
      url: "/api/v1/invitations/inv-1/resend",
      method: "POST",
      body: undefined,
    });
    expect(call.headers.get("Idempotency-Key")).toBe("k-2");
    expect(answer.result).toBe("invited");
  });

  it("revokeInvitation: POST /invitations/:id/revoke with no key", async () => {
    fetchMock.mockResolvedValue(
      json(200, { invitation: { ...INVITATION, state: "revoked" } }),
    );
    await revokeInvitation("inv-1");
    const call = lastCall();
    expect(call).toMatchObject({
      url: "/api/v1/invitations/inv-1/revoke",
      method: "POST",
    });
    expect(call.headers.get("Idempotency-Key")).toBeNull();
  });

  it("changeRole: POST /members/:id/role with the role", async () => {
    fetchMock.mockResolvedValue(json(200, ACCOUNT));
    await changeRole("u-2", "admin");
    expect(lastCall()).toMatchObject({
      url: "/api/v1/members/u-2/role",
      method: "POST",
      body: { role: "admin" },
    });
  });

  it("deactivateMember and reactivateMember: POST with no body", async () => {
    // A Response body can be read once, so each call gets a new one.
    fetchMock.mockImplementation(async () => json(200, ACCOUNT));
    await deactivateMember("u-2");
    expect(lastCall()).toMatchObject({
      url: "/api/v1/members/u-2/deactivate",
      method: "POST",
      body: undefined,
    });
    await reactivateMember("u-2");
    expect(lastCall()).toMatchObject({
      url: "/api/v1/members/u-2/reactivate",
      method: "POST",
      body: undefined,
    });
  });

  it("puts an id with a slash into the path as one segment", async () => {
    fetchMock.mockResolvedValue(json(200, ACCOUNT));
    await deactivateMember("a/b");
    expect(lastCall().url).toBe("/api/v1/members/a%2Fb/deactivate");
  });
});

describe("the key and the timeouts (R5)", () => {
  it("accepts a key from newId when crypto.randomUUID does not exist", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    fetchMock.mockResolvedValue(json(200, { results: [] }));
    const key = newId();
    await inviteMembers({ emails: ["sam@example.com"], role: "member" }, key);
    const sent = lastCall().headers.get("Idempotency-Key") ?? "";
    expect(sent).toHaveLength(36);
    expect(sent).toMatch(IDEMPOTENCY_KEY_PATTERN);
  });

  it("cannot replace Accept through the caller's headers", async () => {
    // The request core owns Accept (a spec point of R5); the call helpers never set it.
    fetchMock.mockResolvedValue(json(200, { results: [] }));
    await inviteMembers({ emails: ["sam@example.com"], role: "member" }, "k-3");
    expect(lastCall().headers.get("Accept")).toBe("application/json");
  });

  // A server that answers after `ms` of the test clock, and honours the abort signal.
  function slowServer(ms: number, body: unknown) {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(json(200, body)), ms);
          init.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
  }

  it("inviteMembers waits for a slow answer (75 000 ms)", async () => {
    vi.useFakeTimers();
    slowServer(20_000, { results: [] });
    const pending = inviteMembers(
      { emails: ["sam@example.com"], role: "member" },
      "k-4",
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toEqual({ results: [] });
  });

  it("resendInvitation waits for a slow answer (75 000 ms)", async () => {
    vi.useFakeTimers();
    slowServer(20_000, { result: "invited", invitation: INVITATION });
    const pending = resendInvitation("inv-1", "k-5");
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toMatchObject({ result: "invited" });
  });

  it("the other calls keep the default 10 s and time out", async () => {
    vi.useFakeTimers();
    slowServer(20_000, ACCOUNT);
    const pending = deactivateMember("u-2");
    const seen = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await seen).toMatchObject({ kind: "timeout" });
  });

  it("inviteMembers times out after 75 s", async () => {
    vi.useFakeTimers();
    slowServer(200_000, { results: [] });
    const pending = inviteMembers(
      { emails: ["sam@example.com"], role: "member" },
      "k-6",
    );
    const seen = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(75_001);
    expect(await seen).toMatchObject({ kind: "timeout" });
  });
});

describe("the file's imports (R5)", () => {
  it("imports nothing but the client, the shared schemas and constants, and the ids", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "admin", "adminApi.ts"),
      "utf8",
    );
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      (match) => match[1],
    );
    for (const specifier of specifiers) {
      expect(["../client", "@toki/shared", "zod"]).toContain(specifier);
    }
    expect(source).not.toMatch(/crypto\.|randomUUID|getRandomValues/);
  });
});
