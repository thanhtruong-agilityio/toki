// Test-only: a migrated throwaway database, the app with a fake mail layer and
// the test clock, and the small calls the auth tests share. Only *.test.ts
// files import it.
import { createTestClock } from "@toki/shared";
import postgres, { type Sql } from "postgres";
import { Writable } from "node:stream";
import { buildApp } from "../../app.js";
import type { Config } from "../../config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrationsFolder, runMigrations } from "../../db/migrate.js";
import { fakeMail } from "../../tests/fake-mail.js";
import { createThrowawayDb } from "../../tests/throwaway-db.js";
import type { FastifyInstance, InjectOptions } from "fastify";

export const SECRET = "s".repeat(40);
export const ORIGIN = "http://localhost:5173";

// Every field a test reads from a response body, typed as present: a test that
// reads a field that is not there fails on the value, not on the type.
type Body = {
  requestId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  token: string;
  name: string;
  id: string;
  workspaceId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    language: string;
  };
  error: {
    code: string;
    message: string;
    details: { retryAfterSeconds: number; triesLeft: number };
  };
};

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export async function createHarness(
  options: {
    development?: boolean;
    trustedProxy?: string;
    registerRoutes?: (scope: FastifyInstance) => void;
    mail?: ReturnType<typeof fakeMail>["layer"];
  } = {},
) {
  const throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  // The app's own connection records the statements it runs (R41).
  const statements: string[] = [];
  const appClient = postgres(throwaway.url, {
    max: 12,
    onnotice: () => {},
    debug: (_connection, query) => {
      statements.push(query);
    },
  });
  const db = drizzle(appClient);
  const sql: Sql = postgres(throwaway.url, { max: 12, onnotice: () => {} });
  const workspaceId = crypto.randomUUID();
  await sql`insert into workspaces (id, name, created_at) values (${workspaceId}, 'Acme', ${new Date("2026-01-01T00:00:00Z")})`;
  const clock = createTestClock();
  const mail = fakeMail();
  const chunks: string[] = [];
  const logStream = new Writable({
    write(chunk, _e, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const config: Config = {
    server: {
      env: "development",
      port: 3000,
      host: "127.0.0.1",
      logLevel: "info",
    },
    database: { url: throwaway.url },
    auth: {
      codeSecret: SECRET,
      appOrigin: ORIGIN,
      trustedProxy: options.trustedProxy,
      development: options.development ?? true,
    },
  };
  const app = buildApp({
    config,
    db,
    clock,
    mail: options.mail ?? mail.layer,
    logStream,
    registerRoutes: (scope) => {
      scope.get("/protected", async (request) => ({
        id: request.account!.id,
        workspaceId: request.account!.workspaceId,
      }));
      scope.get("/public-thing", { config: { public: true } }, async () => ({
        ok: true,
      }));
      scope.patch("/patchable", { config: { public: true } }, async () => ({
        ok: true,
      }));
      scope.put("/puttable", { config: { public: true } }, async () => ({
        ok: true,
      }));
      options.registerRoutes?.(scope);
    },
  });
  await app.ready();

  // Every call comes from its own address unless a test sets one, so the
  // per-address limit of R56 only meets the tests that mean to meet it.
  let next = 0;
  const call = (opts: InjectOptions) => {
    next += 1;
    return app.inject({
      remoteAddress: `10.${(next >> 16) & 255}.${(next >> 8) & 255}.${next & 255}`,
      ...opts,
    });
  };
  const json = (res: { body: string }) => JSON.parse(res.body) as Body;

  async function addUser(
    email: string,
    values: Record<string, unknown> = {},
  ): Promise<string> {
    const id = crypto.randomUUID();
    const row = {
      id,
      workspace_id: workspaceId,
      email,
      display_name: "Test user",
      role: "member",
      status: "active",
      language: "en",
      created_at: new Date("2026-01-01T00:00:00Z"),
      ...values,
    };
    await sql`insert into users ${sql(row as unknown as Record<string, never>)}`;
    return id;
  }

  async function requestCode(
    email: string,
    extra: Partial<InjectOptions> = {},
  ) {
    return call({
      method: "POST",
      url: "/api/v1/auth/codes",
      payload: { email },
      ...extra,
    });
  }

  // The 6 digits of the last mail handed to the layer.
  const lastCode = () => {
    const sent = mail.calls.filter((c) => c.operation === "sendSignInMail");
    return (sent.at(-1)!.input as { code: string }).code;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

  async function exchange(
    requestId: string,
    code: string,
    extra: Record<string, unknown> = {},
    inject: Partial<InjectOptions> = {},
  ) {
    return call({
      method: "POST",
      url: "/api/v1/auth/sessions",
      payload: { requestId, code, ...extra },
      ...inject,
    });
  }

  // Requests a code for an existing address and exchanges it. Returns the
  // secret (cookie value or token) and the response.
  async function signIn(
    email: string,
    transport: "cookie" | "token" = "cookie",
    inject: Partial<InjectOptions> = {},
  ) {
    // Past the 60 seconds of an earlier request for the same address.
    clock.advance(61_000);
    const asked = await requestCode(email);
    const { requestId } = json(asked);
    await flush();
    const res = await exchange(requestId, lastCode(), { transport }, inject);
    const cookie = /^(?:__Host-)?toki_session=([^;]+)/.exec(
      String(res.headers["set-cookie"] ?? ""),
    )?.[1];
    const secret = transport === "token" ? json(res).token : cookie;
    return { res, secret: secret as string, requestId };
  }

  const cookieName = () =>
    config.auth!.development ? "toki_session" : "__Host-toki_session";
  const withCookie = (secret: string) => ({
    cookie: `${cookieName()}=${secret}`,
  });
  const logText = () => chunks.join("");

  async function close() {
    await app.close();
    await appClient.end();
    await sql.end();
    await throwaway.drop();
  }

  return {
    app,
    sql,
    db,
    statements,
    clock,
    mail,
    workspaceId,
    config,
    call,
    json,
    addUser,
    requestCode,
    lastCode,
    flush,
    exchange,
    signIn,
    withCookie,
    cookieName,
    logText,
    close,
  };
}
