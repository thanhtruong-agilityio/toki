import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const id = "01930b7e-7a53-7c2e-9f1a-0123456789ab";
const user = "01930b7e-7a53-7c2e-9f1a-0123456789ac";

// The twelve routes of TOKI-029 (Design, "API"; R22).
const ROUTES = [
  ["POST", "/api/v1/channels", "/api/v1/channels"],
  ["GET", "/api/v1/channels", "/api/v1/channels"],
  ["GET", "/api/v1/channels/:id", `/api/v1/channels/${id}`],
  ["GET", "/api/v1/channels/:id/members", `/api/v1/channels/${id}/members`],
  ["PATCH", "/api/v1/channels/:id", `/api/v1/channels/${id}`],
  ["POST", "/api/v1/channels/:id/join", `/api/v1/channels/${id}/join`],
  ["POST", "/api/v1/channels/:id/members", `/api/v1/channels/${id}/members`],
  ["POST", "/api/v1/channels/:id/leave", `/api/v1/channels/${id}/leave`],
  [
    "DELETE",
    "/api/v1/channels/:id/members/:userId",
    `/api/v1/channels/${id}/members/${user}`,
  ],
  ["POST", "/api/v1/channels/:id/archive", `/api/v1/channels/${id}/archive`],
  ["POST", "/api/v1/channels/:id/restore", `/api/v1/channels/${id}/restore`],
  [
    "PATCH",
    "/api/v1/conversations/:id/settings",
    `/api/v1/conversations/${id}/settings`,
  ],
] as const;

describe("the routes of the channel API (R18)", () => {
  it("registers the twelve routes through buildApp", () => {
    expect(ROUTES).toHaveLength(12);
    for (const [method, pattern] of ROUTES) {
      expect(
        h.app.hasRoute({ method, url: pattern }),
        `${method} ${pattern}`,
      ).toBe(true);
    }
  });

  it.each(ROUTES)(
    "%s %s answers 401 without a session",
    async (method, _p, url) => {
      const res = await h.call({ method, url });
      expect(res.statusCode).toBe(401);
      expect(h.json(res).error.code).toBe("unauthenticated");
    },
  );
});
