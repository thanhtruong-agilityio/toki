import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("the wiring file (TOKI-032 R25)", () => {
  test("exports api, timers, conversations and sessions (TOKI-099 R13), and no clock", async () => {
    const mod = await import("../src/client");
    expect(Object.keys(mod).sort()).toEqual([
      "api",
      "conversations",
      "sessions",
      "timers",
    ]);
    expect(typeof mod.api.request).toBe("function");
    expect(typeof mod.timers.after).toBe("function");
    expect(typeof mod.conversations.load).toBe("function");
    expect(typeof mod.sessions.list).toBe("function");
  });

  test("a 401 with a session code on a call reaches the session state through the hook", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(401, { error: { code: "session_ended", message: "m" } }),
      ),
    );
    const [{ api }, session] = await Promise.all([
      import("../src/client"),
      import("@toki/client-core"),
    ]);
    session.markSignedIn({
      id: "u",
      email: "a@example.com",
      displayName: "A",
      role: "member",
      language: "en",
    });
    await api.bootstrap().catch(() => undefined);
    expect(session.getSessionState()).toMatchObject({ status: "ended" });
  });

  test("a 401 with another code does not", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(401, { error: { code: "invalid_code", message: "m" } }),
      ),
    );
    const [{ api }, session] = await Promise.all([
      import("../src/client"),
      import("@toki/client-core"),
    ]);
    await api.bootstrap().catch(() => undefined);
    expect(session.getSessionState().status).toBe("unknown");
  });

  test("createApiClient( appears once in apps/web/src, and createConversationStore( once", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name)) files.push(path);
      }
    };
    walk(root);
    const count = (needle: string) =>
      files.filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(count("createApiClient(")).toHaveLength(1);
    expect(count("createApiClient(")[0]).toMatch(/client\.ts$/);
    expect(count("createConversationStore(")).toHaveLength(1);
  });
});
