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
   └─ conversations/{store,merge,names,search,selectors}.ts   (+ *.test.ts, contract.test-d.ts or a type test)
apps/web/
├─ package.json                      @toki/client-core is already a dependency; nothing to add
├─ src/timers.ts                     createTimers(host)
├─ src/client.ts                     api, timers, conversations; api.setOnUnauthenticated(reportUnauthenticated)
├─ src/auth/services.ts              builds the calls from api.request through a small adapter; openCalls and the second timers go
├─ src/auth/fetch-api.ts, src/auth/timers.ts   deleted (stand-ins)
├─ src/auth/request-adapter.ts       turns api.request (rejects with ApiError) into the ApiRequest the sign-in calls take (never rejects)
└─ tests/                            timers test, client test, adapter test; fetch-api.test.ts is replaced by the adapter test
```

### How it differs from the spec's text, and decisions to confirm

1. **Replacing the stand-in.** `createSignInCalls`/`createEmergencyCalls` keep taking `ApiRequest` (their own tests stay). `client.ts` makes the one client; `services.ts` passes `toApiRequest(api.request)` from `src/auth/request-adapter.ts`, which calls `api.request({ method, path, body, schema: z.unknown() })` and maps what it resolves or rejects with to `ApiResult` (`ok` with status and data, `http` with status, code and details, `network`, `timeout`, `invalid_response`). An `aborted` error cannot happen (no signal is passed). The adapter lives in `apps/web`, not in `client-core/auth`, because the spec says the `auth/` folder imports neither `api/` nor `conversations/`.
2. **`openCalls` and the emergency calls lose their own no-hook client.** With one client the 401 hook fires for all three codes on every call. This changes nothing seen: the open read runs while the session state is `unknown`, where `reportUnauthenticated` gives `signedOut` as `markSignedOut()` does; the public routes of the server answer no 401 with those codes (the session check skips them). `readSessionOnOpen` keeps its `isPublic` branch unchanged. If this is not wanted, say so before the build.
3. **`api.request` needs a `schema`.** The sign-in calls parse their answers themselves with the shared schemas; the adapter passes `z.unknown()`, so no unknown key is dropped before them.
4. **`apps/web` `timers`.** `createTimers(host)` and `client.ts` follow R25; the old `src/auth/timers.ts` and its users (`login.tsx`, `__root.tsx`, the test harnesses) import `timers` from `src/client.ts`, so the app has one timer function.
5. **The lenient reading (R3)** is a walk over the schema in `api/parse.ts` that rebuilds each object as a non-strict `z.object` with the same lenient fields, for `object`, `array`, `nullable`, `optional`, `union`, `literal`, `enum`, `string`, `number`, `boolean`, `null`, `undefined`, `unknown`; a union's options are tried with the most required keys first (a detail before a summary); `kind` already separates the conversation entries. A schema type the walk does not know throws when the client is made, not at the first answer (a test lists the types the shared schemas use, so a new one fails here). The exported schemas are not touched.
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
| R25 wiring | 8 | `apps/web/tests/timers.test.ts`, `client.test.ts`, `auth/request-adapter.test.ts`; `pnpm --filter ./apps/web build` |
| R26 answers after a later change | 6 | `conversations/store.order.test.ts` |
| R27 contract | 7 | `conversations/contract.test.ts` (type test) |

## What can break, and the riskiest step

- **Step 2, the lenient reading.** A walk over zod 4 internals can silently keep strictness at one level (an added key then fails in production with the answer of a newer server) or lose a union rule. The tests drop a key at every level of `BootstrapResponse`, `ChannelDetail` and the direct response, and the walk throws on a schema type it does not know, so a new shared schema type fails a test rather than the client.
- **Step 6, ordering and staleness (R11, R26).** The rules interact (generation, per-id counters, total counter, `saveSettings` numbering). Each has its own test written before the code, with a fake `api` whose answers are released by the test in both orders.
- **Step 8, the replaced stand-in.** The login, emergency and open-read paths run through the new request layer. The adapter test checks every kind of result, and the existing route tests (`login`, `emergency`, `app-layout`) must stay green with the harness now giving a fake `api.request` through `setAuthServices`.
- A snapshot or selector that returns a new object each call would pass a one-call test: the tests compare with `===` after a change that touches nothing they read.
