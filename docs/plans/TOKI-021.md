# TOKI-021 Sending mail over SMTP: plan

Ticket: TOKI-021 (issue 113). Branch: `feat/toki-021-smtp-mail-layer`. Tier: M.
Spec (the source of truth, with the decisions of 2026-11-18): `docs/specs/2026-11-17-mail-smtp-design.md`.
Requirements are named `R1` to `R26`, concerns `1` to `12`, as in the spec; this plan does not copy them, the tests type their values in from the spec.

## Design

The spec is the design (Configuration, API, What each mail says, Layout, Errors, Testing, Data safety). This plan adds only what the repository and the order of work change. What the repository holds today:

- `apps/server/src/config.ts` is the only reader of the environment. It has one zod schema per area (`server`, `database`), a `configVariableNames` map that `config.test.ts` compares with `.env.example`, and `Config` is a type with every area required. The environment name is `NODE_ENV` (`development` or `production`), the value `config.server.env`.
- R1 puts the mail schema in `modules/mail/config.ts`, exported through `modules/mail/index.ts`; the root `config.ts` imports it from there. `Config` gets `mail?: MailConfig` (R21), so the tests that build a `Config` without mail keep compiling. `loadConfig` takes the area list, so only `main.ts` asks for `mail`.
- `.env.example` and `docs/environment-config.md` already hold the seven variables with the names, defaults and development values of the spec. Nothing is added there. The existing test `config.test.ts` ("every name the schema reads is in .env.example") covers R2 once `configVariableNames.mail` exists.
- `buildApp` has `config`, `logStream` and `registerRoutes`; it has no close hook yet. `main.ts` already stops with `app.close()` on SIGTERM and SIGINT. `src/test/main.test.ts` starts the real `main.ts` with a fixed environment (no SMTP value), so it gets the three mail values (spec, Hand-offs: TOKI-004).
- `modules/` holds `auth`, `members`, `notifications` and `workspace` (schemas only). The ESLint rule `toki/module-entry` (TOKI-002) already forbids imports of a module's inner files from outside; R1's own test adds the `nodemailer` search.
- `@toki/i18n` exports `translate` and `createTranslator` from a main entry with no React (`./react` is separate). `apps/server` does not depend on it yet; `package.json` gets `"@toki/i18n": "workspace:*"`. A namespace is added in `messages/en/index.ts` and `messages/vi/index.ts`. `pnpm --filter @toki/i18n check` is the missing-translation check.
- Commands run from the root with Node 22: `export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"` and `corepack pnpm ...`. Server unit tests: `corepack pnpm --filter @toki/server test:unit`.

Build order (each step ends green, in this order):
1. dependencies 2. i18n texts (R22) 3. configuration (R2 to R4) 4. render functions (R7 to R12, R22, R24, R26) 5. classify (R16) 6. the layer (R5, R6, R9, R13 to R15, R17, R19, R25) 7. TLS (R4) 8. `buildApp`, `main.ts`, close (R18, R20, R21) 9. boundary test (R1) 10. by hand against Mailpit (R23).

## AC to step to test

The acceptance criteria this ticket serves are those of the intent: one mail layer that sends through configurable SMTP, the three mails in English and Vietnamese (invitations in English), and a failure that is told to the caller with the code and address kept out of the log. The rows follow the requirements of the spec.

| Requirement | Step | Test (written first, seen to fail) |
| :---- | :---- | :---- |
| R1 | 9 | `boundary.test.ts`: search of `apps/server/src` for imports into `modules/mail/` other than `index.ts` and for `nodemailer` outside it; `pnpm lint` |
| R2 | 3 | `config.test.ts`: `configVariableNames.mail` equals the eight names (the seven and `NODE_ENV`) and each is in `.env.example` (existing test, extended) |
| R3, R4 | 3 | `modules/mail/config.test.ts`: each variable missing, empty, invalid; the login pair; `none` with `NODE_ENV` `production`, with none set and with `development`; `none` with a login; value absent from `ConfigError` and from standard error of `main.ts` |
| R4 (TLS) | 7 | `tls.test.ts` with `selfsigned` and `tlsCa`: STARTTLS off -> `unavailable`; untrusted certificate on `starttls` and `tls`; wrong host name; right name delivered on both; `none` against STARTTLS delivered in clear; script search for `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED` and a variable reaching `tlsCa` |
| R5 | 6 | `layer.test.ts`: two test SMTP servers, two configurations, same call, each delivers to its own with its own sender |
| R6, R9 | 6 | `layer.test.ts`: `invalid_input` and no connection for a bad code, address, language, names over 200 characters, `joinUrl` not `https` (or `http` when not production); the address check list of R6; `{ name, address }` objects |
| R7, R8, R10 to R12, R24 | 4 | `render.test.ts`: the three mails in both languages, words against the table; code in one piece; absence list on both parts; one `<a>`; `joinUrl` with `#` kept; `<script>`, `Bcc` line break and `"`, `&` cases; headers; subject without code |
| R11 | 6 | `layer.test.ts`: full send of each mail, parsed with `mailparser`: sender, recipient, subject, two parts, `Auto-Submitted`, Vietnamese round trip |
| R13, R14 | 6 | `log.test.ts`: capture stream, standard output and standard error; success, each reason, invalid input; one layer line per send with the fields of R14; code, address, `joinUrl` and password absent, with a refusing server that repeats address and code in its reply |
| R15 | 6 | `timeouts.test.ts`: silent server -> `unavailable` within the greeting limit; slow-reply server that only the whole-send limit can end, nothing delivered late and the connection closed |
| R16 | 5, 6 | `classify.test.ts` on error shapes, then `layer.test.ts` one test server per reply case |
| R17 | 6 | `layer.test.ts`: 451 on the first message, exactly one attempt for one call |
| R18 | 8 | `main.test.ts`: `SMTP_HOST` and `SMTP_PORT` point at a TCP listener of the test that counts connections; `/healthz` answers ok and the count stays 0 |
| R19 | 6 | `layer.test.ts`: 10 concurrent sends, never more than 2 open connections, all 10 arrive |
| R20 | 8 | `app.test.ts`: after `app.close()` the test server reports no open connection |
| R21 | 8 | `app.test.ts`: fake `mail` records calls through a test route and `app.mail` exists inside `registerRoutes`; `close` is registered only when `buildApp` built the layer; neither `mail` nor `config.mail` throws and names `mail`; real layer built from `config.mail`; `app.mail` exists before routes |
| R22 | 2, 4 | `render.test.ts` with `[[key]]` translate; `pnpm --filter @toki/i18n check` |
| R23 | 10 | by hand with `pnpm dev:up`: a script sends the three mails to Mailpit; result written in the pull request |
| R25 | 6 | `queue.test.ts` with shortened limits: 50 sends to a silent server within about one greeting limit and at most 2 connections; queue limit of 3; wait limit gives `queue_wait` and is never delivered; after the cooldown a send to a returned server is delivered |
| R26 | 4 | `render.test.ts`: minutes and days in the mail equal the constants; the constants are pinned to D-136 and D-037 |

## Steps

1. Dependencies of `apps/server`: `nodemailer` and `@types/nodemailer`; development: `smtp-server`, `@types/smtp-server`, `mailparser`, `@types/mailparser`, `selfsigned`; plus `@toki/i18n` (`workspace:*`). Exact versions, as the repository does; check each licence against the repository's rule and write the result in the pull request.
2. `packages/i18n/src/messages/{en,vi}/mail.ts` with the 14 keys of the table, listed in both `index.ts` files; `pnpm --filter @toki/i18n check` and its tests pass.
3. `modules/mail/config.ts` (schema, rules R3 and R4, `MailConfig`) and `index.ts`; the root `config.ts` composes it, `Config.mail` optional, `configVariableNames.mail`; tests first.
4. `modules/mail/render.ts` (three pure functions taking `t`, the values and the lifetimes), the constants file of R26, escaping and header cleaning; tests first. The rules of R4 (`none` needs `NODE_ENV` exactly `development`, `none` with a login) are a `superRefine` with `path: ["SMTP_TLS"]`, because `loadConfig` names `issue.path[0]`; inside the mail schema `NODE_ENV` is an optional string, so a missing one fails closed through `SMTP_TLS` and names no second variable. `Config` is written as `{ server, database, mail? }`.
5. `modules/mail/classify.ts`: sorts an error into `reason`, `cause`, `stage` and reply code; tests first. First record, from the real test server, the `code`, `command` and `responseCode` of a refused connection, a greeting timeout, a socket timeout and a TLS failure; only the connection-level causes (no connection, DNS, TLS, connect or greeting timeout) start the cooldown, never a socket timeout, a whole-send timeout or a 4xx reply (tested).
6. `modules/mail/layer.ts`: input checks, Nodemailer transport (pool 2, `requireTLS`, `secure`, `ignoreTLS` as in Design), the gate of 2, the queue and its limits, the whole-send timer, the cooldown, the one log line, `close`. Test helper `test/smtp-server.ts` starts `smtp-server` with a behaviour (accept, reply code to a command, silent, slow, count connections). Each transport has a generation number: when it is swapped, the layer itself resolves every send in flight on it as `unavailable` and ignores later callbacks; sockets are really destroyed (Nodemailer's `getSocket` hands the layer the `net` socket, so `destroy()` also ends TLS; if that fails, a test shows what `close()` does); `transport.on("error")` is attached so a pool error never crashes the process; a slot is freed only after that send's socket is closed. Tests in the groups of the table, each seen to fail first; the R15 and R25 tests also assert that the server never sees more than 2 open connections, and that a whole-send timeout does not start the cooldown.
7. TLS tests and the search for any switch that turns the certificate check off (R4).
8. `buildApp` gets the optional `mail`, builds the real layer from `config.mail` and `NODE_ENV`, `decorate("mail", ...)` before `registerApi` (with `declare module "fastify"` for the type), close hook only for a layer it built itself; `main.ts` loads `["server", "database", "mail"]`; `main.test.ts` environment gets the three variables; tests first.
9. Boundary test of R1; `pnpm lint`, `pnpm typecheck`, root `pnpm test`, `pnpm format:check`.
10. R23 by hand against Mailpit (needs Docker for `pnpm dev:up`); the user runs it if Docker is not available to this session.

## What can break, and the riskiest step

- Riskiest step: 6, the whole-send limit and the cooldown (R15, R25). Nodemailer has no whole-send timer and its pool keeps connections, so "destroy that send's connection and build a new transport" can leave a send on the old transport running or deliver after the caller was told it failed. The slow-server test (a reply to every command, each shorter than the socket limit) and the "nothing arrives late" check keep this honest. Build the gate, the timer and the transport swap first, with only the silent-server test, then add the rest.
- Nodemailer behaviour that the spec relies on (`ignoreTLS` for `none`, `requireTLS` for `starttls`, errors with `code`, `responseCode`, `command`) must be seen in a test, not assumed: step 5 reads real errors produced by the test server before `classify.ts` is written.
- `smtp-server` and `mailparser` bring many sub-dependencies; they are development only. A licence or audit problem is reported in the pull request, not hidden.
- The remaining race of R15: once the client has sent the final `.` of DATA a server may still deliver although the client then disconnects, so "nothing arrives late" holds only when the timer fires before the body ends. Test (b) places its delays so the timer fires before DATA ends, and the test server counts a message only at its 250 reply. The race is named in the pull request.
- `@toki/i18n` declares `react` as a peer dependency; the install may warn in `apps/server` (harmless: the main entry imports no React). The root `config.ts` importing `modules/mail/index.ts` makes every tool that loads the configuration load Nodemailer; `layer.ts` never imports the root `config.ts`, so there is no cycle.
- R26 constants carry a comment naming the TOKI-022 and TOKI-024 constants that replace them (neither exists yet). The pull request says the inventory kept two port rows (`SMTP_PORT`, `MAILPIT_SMTP_PORT`), which satisfies R2's "nothing written twice".
- Certificates for the TLS tests are made by `selfsigned` at run time and are never written to the repository (a secret scanner flags a private key).
- `Config.mail` optional: modules that later read `config.mail` must handle `undefined`; only `buildApp` reads it here (R21).
- `main.test.ts` spawns the real server: with `mail` in the area list, a missing SMTP value now fails startup; the fixed environment of that test is updated in the same step.
- Timing tests with shortened limits can be flaky on a slow machine; limits in tests leave a margin of several times the work, and no test asserts an upper bound under 5 times the limit it shortened.
- The code and the address must stay out of every log and every error text: R13's test captures standard output and standard error as well as the app log.
- Roll back: delete `modules/mail/`, the `mail` texts of the i18n package, the `mail` input of `buildApp`, the `mail` area and the new dependencies; nothing else calls the layer yet (TOKI-022 and TOKI-024 call it later).

## Grilling (M, one round)

Questions asked of the plan, with the answers that changed it:

1. Does the plan add `.env.example` lines? No: the seven rows already exist in `.env.example` and in `docs/environment-config.md` (TOKI-096), with the names of the spec; the existing names test covers R2.
2. Does making `Config.mail` optional break a test that builds a `Config`? No: optional adds no required key; the tests of `buildApp` that need mail pass a fake layer (R21).
3. Which environment name does R4 read? `NODE_ENV` of the `server` area (`config.server.env`); `createMailLayer` receives `production` from `buildApp`, and the config rule of R4 needs the raw `NODE_ENV` in the same schema pass. `loadConfig` hands an area only the names listed for it, so `configVariableNames.mail` lists `NODE_ENV` besides the seven (the names test then also finds it in `.env.example`), and a missing or other `NODE_ENV` fails closed for `none`.
4. Is R23 part of the automated run? No (spec); step 10 is by hand and may need the user's terminal for Docker.
