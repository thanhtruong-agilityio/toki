# TOKI-032 client-core: API client and conversation store: plan

Ticket: TOKI-032 (issue 120) · Tier L · Branch `feat/toki-032-client-core`
Spec (source of truth, accepted in PR 168): `docs/specs/2026-11-17-client-core-design.md`. Requirement numbers `R1`..`R27` below are the spec's; each requirement's "Check" sentence is the list of cases its test holds. The shared schemas it reads (`BootstrapResponse`, channel and direct-conversation schemas) are on `main` after TOKI-029, TOKI-030 and TOKI-031.

## Design

The spec fixes behaviour. This section says how it fits the code as it is now, and where the code on `main` already differs from the spec's text.

### What is already there, and what that changes

- `packages/client-core` has `src/auth/` (TOKI-023: session store with `reportUnauthenticated`, `createSignInCalls`, `createEmergencyCalls`) and takes `@toki/shared` only. Imports there have no `.js` suffix and tests sit beside the code (`*.test.ts`); this ticket follows both.
- TOKI-023 was built **before** this ticket and left stand-ins in `apps/web`: `src/auth/fetch-api.ts` (a 10-second request layer with `ApiResult`), `src/auth/timers.ts` and `AuthServices.{calls, openCalls, emergency, timers}` in `src/auth/services.ts`. Their comments say this ticket replaces them. The spec's R25 covers the case "TOKI-023 first" only by one line (the 401 hook); here the whole stand-in goes (decided below, "Replacing the stand-in").
- `apps/web/src/clock.ts` already exists (TOKI-023 R45); `client.ts` must not add a clock (R25).
- Scripts: `scripts/check-clock-use.sh` (TOKI-008 R19) bans `Date.now(`, `new Date()` and a bare `setTimeout(`/`setInterval(` in `packages/client-core/src` outside tests; ESLint rule 1 limits the globals.

### Where the code goes

```
packages/client-core/
├─ package.json                      adds zod (same version as @toki/shared)
└─ src/
   ├─ index.ts                       adds the exports of R1 and the types of R27
   ├─ api/{client,errors,parse,classify}.ts   (+ *.test.ts)
   └─ conversations/{store,merge,names,search,selectors}.ts   (+ *.test.ts, contract.test.ts as the type test)
apps/web/
├─ package.json                      @toki/client-core is already a dependency; nothing to add (no zod)
├─ src/timers.ts                     createTimers(host)
├─ src/client.ts                     api, timers, conversations; api.setOnUnauthenticated(reportUnauthenticated)
├─ src/auth/services.ts              builds the calls from the client through the adapter; openCalls goes, timers is filled from client.ts
├─ src/auth/open-read.ts             public route + unauthenticated: markSignedOut() before the early return
├─ src/auth/fetch-api.ts, src/auth/timers.ts   deleted (stand-ins)
├─ src/auth/request-adapter.ts       turns api.request (rejects with ApiError) into the ApiRequest the sign-in calls take (never rejects)
└─ tests/                            timers test, client test, adapter test; fetch-api.test.ts is replaced by the adapter test
```

### How it differs from the spec's text, and decisions to confirm

1. **Replacing the stand-in.** `createSignInCalls`/`createEmergencyCalls` keep taking `ApiRequest` (their own tests stay). `client.ts` makes the one client; `services.ts` builds the calls from `toApiRequest(api)` in `src/auth/request-adapter.ts`, which calls `api.requestWithStatus({ method, path, body, schema: anyAnswer })` and maps what it resolves or rejects with to `ApiResult` (`ok` with the real status and data, `http` with status, code and details, `network`, `timeout`, `invalid_response`; `aborted` cannot happen, no signal is passed). The adapter lives in `apps/web`, not in `client-core/auth`, because the spec says `auth/` imports neither `api/` nor `conversations/`. `anyAnswer` is a passthrough schema (`z.unknown()`) exported by `client-core`, so `apps/web` needs no `zod` dependency; the sign-in calls parse their answers themselves, so no key is dropped before them.
2. **`requestWithStatus`** is a member of the client beyond the spec's list: the typed methods need the status for `created` (R9, 201 against 200) and the adapter needs it for `ApiResult.ok`. `request` returns the parsed data of the same call. Recorded as a deviation; the contract table (R27) lists `request`, and the type test also pins the extra member.
3. **`openCalls` goes, with a fix in `open-read.ts`.** With one client the 401 hook fires inside the request, before `readSessionOnOpen` looks at the result. `reportUnauthenticated("account_deactivated")` in the state `unknown` gives `ended/deactivated`, so a public route would show the modal that R40 of TOKI-023 forbids. The fix: when `isPublic` and the outcome is `unauthenticated`, call `markSignedOut()` first (it moves `ended` to `signedOut`), then the early return. The emergency and code routes answer a deactivated person with 400, so they are not affected. The existing emergency test uses fake calls that never reach the hook, so a new test runs the open read through a real client (`createApiClient` with a fake `fetch`) on a public route and a 401 `account_deactivated`.
4. **`timers` stays in `AuthServices`.** The login and root routes keep reading `timers` from `getAuthServices()`, so the many `t.timers.advance(...)` calls of the login tests keep driving them. `build()` fills `timers` from `client.ts`. `services.ts` loses `openCalls` only; the harnesses (`auth-harness.tsx`, `load-app.tsx`) and the tests that name `openCalls` (`root.test.tsx`, `emergency.test.tsx`, `app-providers.test.tsx`, `app-layout.test.tsx`) are updated for that. The old `src/auth/timers.ts` goes; its `Timers` type moves to `client.ts`/`timers.ts`.
5. **The lenient reading (R3)** is a walk over the schema in `api/parse.ts` that rebuilds each object as a non-strict `z.object` with the same lenient fields, for `object`, `array`, `nullable`, `optional`, `union`, `literal`, `enum`, `string`, `number`, `boolean`, `null`, `undefined`, `unknown`; a union's options are tried with the most required keys first (a detail before a summary); `kind` already separates the conversation entries. A check (`.regex`, `.int()`, `.min()`, `.nonnegative()`, a refinement) sits in `def.checks` of the same node and is **kept**: leaves are reused as they are, and objects and arrays are rebuilt with `schema.clone({ ...def, shape, catchall: undefined })` so their checks survive. The walk is lazy and cached in a `WeakMap` per schema (a caller passes its own schema to `request`); a schema type it does not know ends the request with `invalid_response` and a test lists the types the shared response schemas use (strictObject, object, union, array, nullable, optional, enum, literal, null, string, number, boolean, unknown, undefined), so a new type fails a test. The exported schemas are not touched.
6. **The store** is one closure over an immutable `state` object, replaced on each change; selectors keep a `Map` of results per argument key, cleared when `conversations`, `people` or `unread` change (R22). Commands carry the generation number (R11) and the per-id and total counters (R26).

### Tests and commands

Vitest in `packages/client-core` (unit, no clock, fake `fetch`, fake `timers`, fake `api`) and in `apps/web`. Commands (Node 22): `corepack pnpm exec vitest run --project client-core` (or `packages/client-core`), `corepack pnpm --filter @toki/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `bash scripts/check-clock-use.sh`, `pnpm --filter ./apps/web build`.

## Steps (test first)

1. **Package and errors**: `zod` dependency; `api/errors.ts` (`ApiError`), `api/classify.ts`. Tests R4, R8.
2. **Lenient parse**: `api/parse.ts` and its tests against the shared schemas (R3), including `z.undefined()`, unions and the types the shared schemas use.
3. **Request core**: `api/client.ts` `request`, timeout, abort, hook, `headers`, `timeoutMs` (R2, R5, R6, R7).
4. **Typed methods** (R9), one test per row of the table.
5. **Names, order, search** (`names.ts`, `search.ts`; R17 to R19) and the merge rule (`merge.ts`; R13, R14).
6. **Store**: state, subscribe, load/refresh/reset, generation (R10 to R12); commands and the ordering rules (R15, R16, R26).
7. **Selectors and lookups** (R20 to R23), the contract type test (R27), exports and the no-text check (R1, R24).
8. **Web wiring** (R25): `timers.ts`, `client.ts`, `request-adapter.ts`, `services.ts`, delete the stand-ins, move the old tests.
9. Whole repository tests, lint, typecheck, format, build and size check; hand check (needs a running server: left to the person who merges).

## AC to step to test

| Req | Step | Test |
|---|---|---|
| R1 package, globals, search script | 1, 7 | `pnpm typecheck`, `pnpm lint`, `scripts/check-clock-use.sh`, `exports.test.ts` |
| R2 request core (query, body, headers, credentials, no Origin) | 3 | `api/client.test.ts` |
| R3 lenient reading, unions, `z.undefined()` | 2 | `api/parse.test.ts`, `api/client.test.ts` |
| R4 `ApiError` | 1 | `api/errors.test.ts` |
| R5 network, timeout, abort, `timeoutMs` | 3 | `api/client.test.ts` |
| R6 no retry | 3 | `api/client.test.ts` |
| R7 401 hook | 3 | `api/client.test.ts` |
| R8 `classifyApiError` | 1 | `api/classify.test.ts` |
| R9 typed methods | 4 | `api/methods.test.ts` |
| R10 state, load, refresh | 6 | `conversations/store.test.ts` |
| R11 reset, stale answers | 6 | `conversations/store.reset.test.ts` |
| R12 subscribe, snapshots | 6 | `conversations/store.test.ts` |
| R13 merge rule | 5 | `conversations/merge.test.ts` |
| R14 details | 5, 6 | `conversations/merge.test.ts`, `store.commands.test.ts` |
| R15 commands | 6 | `conversations/store.commands.test.ts` |
| R16 hand-offs | 6 | `conversations/store.commands.test.ts` (search of `refresh(` in the package) |
| R17 names | 5 | `conversations/names.test.ts` |
| R18 order | 5 | `conversations/names.test.ts` |
| R19 search | 5 | `conversations/search.test.ts` |
| R20 filters and the slot | 7 | `conversations/selectors.test.ts` |
| R21 the list | 7 | `conversations/selectors.test.ts` |
| R22 stable results | 7 | `conversations/selectors.test.ts` |
| R23 lookups | 7 | `conversations/selectors.test.ts` |
| R24 no text, no time | 7 | `conversations/no-text.test.ts`, package.json check |
| R25 wiring | 8 | `apps/web/tests/timers.test.ts`, `client.test.ts` (imports `api`, `timers`, `conversations`; the search for `createApiClient(` covers `apps/web/src`), `auth/request-adapter.test.ts`, `auth/open-read-real-client.test.ts`; `pnpm --filter ./apps/web build`; `pnpm ls --filter @toki/client-core` and `pnpm typecheck` for the dependency |
| R26 answers after a later change | 6 | `conversations/store.order.test.ts` |
| R27 contract | 7 | `conversations/contract.test.ts` (type test) |

## What can break, and the riskiest step

- **Step 2, the lenient reading.** A walk over zod 4 internals can silently keep strictness at one level (an added key then fails in production with the answer of a newer server) or lose a union rule. The tests drop a key at every level of `BootstrapResponse`, `ChannelDetail` and the direct response, and the walk throws on a schema type it does not know, so a new shared schema type fails a test rather than the client.
- **Step 6, ordering and staleness (R11, R26).** The rules interact (generation, per-id counters, total counter, `saveSettings` numbering). Each has its own test written before the code, with a fake `api` whose answers are released by the test in both orders.
- **Step 8, the replaced stand-in.** The login, emergency and open-read paths run through the new request layer. The adapter test checks every kind of result, and the existing route tests (`login`, `emergency`, `root`, `app-providers`, `app-layout`) must stay green with the harnesses giving fake `SignInCalls` without `openCalls`; the regressions the fakes cannot see (a real client on a public route with 401 `account_deactivated`) get a test of their own.
- A snapshot or selector that returns a new object each call would pass a one-call test: the tests compare with `===` after a change that touches nothing they read.

- Comments in `packages/client-core/src` must not contain `setTimeout(`, `setInterval(` or `new Date()`: `scripts/check-clock-use.sh` greps comments too. The store uses no `structuredClone`, `TextEncoder`, `crypto` or `globalThis` (not on the allow list of rule 1).
