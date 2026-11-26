# TOKI

## What the project is

Toki is an internal team chat for one company: channels, direct messages, threads and files, and later tasks, calendar, video meetings, a guest portal, automations, mail and AI summaries. It is single-tenant and self-hosted: each company runs its own copy on its own server. It is built in phases by one person working with Claude; phase 1 is core chat on the web. The prototype is the only design source.

## Repository layout

```
toki/
├─ apps/
│  ├─ server/        Fastify: REST API + WebSocket + worker
│  └─ web/           React + Vite
├─ packages/
│  ├─ shared/        Zod schemas, types, permissions, @mention parsing
│  ├─ client-core/   API client, WebSocket sync, cache, stores. No DOM
│  ├─ tokens/        Colours, fonts, spacing -> CSS variables and React Native styles
│  ├─ i18n/          vi and en translations
│  ├─ platform/      Platform interface + web and native implementations
│  └─ ui-web/        React DOM components + CSS carried over from the prototype
├─ e2e/              Playwright end-to-end tests
├─ scripts/          Development services: up, down, reset
├─ tools/            Lint rules and the bundle size check
└─ docs/             intents, specs, plans and reference documents
```

## Working agreements

- One ticket per branch, named `<type>/<ticket>-<slug>` (ticket id in lowercase). Never commit or push to `main`, `master`, `develop` or `release/*`.
  - Example: `docs/toki-095-claude-md-sections`.
- Commits follow Conventional Commits with a lowercase subject. PRs follow `.github/pull_request_template.md`.
  - Example: `docs(claude): add the project sections to claude.md (TOKI-095)`.
- Tickets are done per `docs/definition-of-done.md`.
- Never paste client secrets or customer data into any AI tool. AI output is a proposal until it has been run.
- Push to your own ticket branch and open its pull request without asking.
- Never merge a pull request and never force-push; merging is done by a person on GitHub.
- Ask before every branch deletion and deploy.
- Start work with `/cl-core:ticket <ticket>`. The exception is an unattended run the user started (many intents, specs or review fixes in parallel): do not stop at confirmation gates there; record each choice you made and each question you could not answer in the pull request, and report them at the end.

## Advisor

An advisor model (Opus) is configured for this repository. Consult it:

- before you commit to a plan or an approach:
  - during brainstorming, consult it once, on the written design, before you ask the user to approve it (not on every question);
  - for small tickets that skip design, do not consult it at this point;
- when the same error has happened twice;
- before you report the work as done.

Say in one line what you are asking it. If its guidance conflicts with the code or the test output, say so instead of following it blindly.

## Never do

1. Merge a pull request, force-push, or push to `main`, `master`, `develop` or `release/*`. Source: Working agreements above.
2. Commit a secret or a `.env` file. Source: `docs/environment-config.md` ("Secrets live in `.env`, never in git") and `.gitignore`.
3. Import a file of another server module other than its public entry file `index.ts` (a command entry under `apps/server/src/cli/` may also import a module's `cli.ts`). Source: lint rule `toki/module-entry`; `docs/specs/2026-11-12-server-skeleton-design.md`, R17; `docs/specs/2026-11-17-sessions-emergency-access-design.md`, R23.
4. Use a DOM or browser API in `client-core`, `shared`, `i18n` or `tokens`. Source: lint rule `toki/client-core-globals`.
5. Use the notification, storage, service worker or audio API directly in `ui-web`, instead of going through `platform`. Source: lint rule `toki/platform-apis`.
6. Add a tool that runs code to the `PR review` workflow, or put text from a comment or a pull request into a `run:` script other than through `env:`. Source: `.claude/rules/workflows.md`.
7. Hard-code a tracker status name instead of the logical keys of `docs/ticket-config.yml`. Source: `.claude/rules/ticket.md`.
8. Work around a command that `.claude/settings.json` denies. Source: Claude configuration below.

## Common commands

The root `pnpm` scripts, run from the repository root under Node 22 (`.nvmrc`) with the pnpm version of `package.json`.

| Command | What it does |
| :---- | :---- |
| `pnpm install` | Install the workspace |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | ESLint, including the boundary rules; a warning fails |
| `pnpm format`, `pnpm format:check` | Prettier: rewrite, or check only |
| `pnpm test`, `pnpm test:e2e` | Run the tests (see Running tests) |
| `pnpm test:e2e:parity` | The UI parity check: the app against the prototype, in the Playwright container (needs Docker; `linux/arm64`); writes `e2e/assets/parity/report.md`. A difference is reported, not a failure |
| `pnpm ui:reference <screen-id>... \| --all [--update]` | Make the reference images of a screen from the prototype, in the same container; an image that exists is kept unless `--update` is given |
| `pnpm ui:save [--no-run] [--no-images] [--update]` | Run the parity check and keep its report and images in `docs/ui-parity/<date>-<commit>/`; refuses to replace a kept run unless `--update` is given |
| `pnpm ui:save --prune <n>` | Print the `git rm -r` command for each kept run older than the newest `n`; deletes nothing |
| `pnpm build`, `pnpm size`, `pnpm i18n:check` | Build every package; check the bundle size; check the vi and en translations |
| `pnpm dev` | Run the `dev` script of each package that has one |
| `pnpm env:pull` | Write the root `.env` from the Doppler project `toki`, config `dev` (needs the Doppler CLI and a login) |
| `pnpm start:local` | Start the services, apply the migrations, run the server and the web app, and print the address |
| `pnpm dev:up`, `pnpm dev:down` | Start or stop Postgres, MinIO and Mailpit (needs Docker and a root `.env`) |
| `pnpm dev:reset`, `pnpm dev:reset:db`, `pnpm dev:reset:files`, `pnpm dev:reset:mail` | Wipe development data, all stores or one |
| `pnpm db:generate`, `pnpm db:migrate` | Create a migration from the table definitions; apply every pending migration |

## Commands

```bash
# One package: test, or any script of its package.json
pnpm --filter @toki/<name> test

# Print a one-time sign-in link, valid 10 minutes, for one member when mail is down. Standard output
# holds the link alone; the log line and every explanation go to standard error. Exit 0 a link was
# printed, 1 refused (no account, deactivated, or another run for the member at the same moment) or a
# bad configuration or failure, 2 wrong call. Needs DATABASE_URL and APP_ORIGIN; the form without
# --silent adds pnpm header lines to standard output.
pnpm --silent emergency:link <email>

# Check one spec before its pull request (exit 0 ready, 1 gaps, 2 wrong usage)
bash .github/scripts/spec-ready.sh docs/specs/<file>.md

# QA and acceptance after the merge (no network, no model; exit 0 no gap, 1 gaps, 2 wrong usage).
# Each script has a test next to it: qa-ready.test.sh, acceptance-ready.test.sh, trace.test.sh.
bash .github/scripts/qa-ready.sh <KEY>               # docs/qa/<KEY>.md passes: every row run and Pass
bash .github/scripts/acceptance-ready.sh <slug>      # docs/acceptance/<slug>.md (or milestone-<m>) is sound
bash .github/scripts/acceptance-ready.sh <slug> --ready   # can the outcome be accepted now (exit 0 ready)
bash .github/scripts/trace.sh                        # write docs/traceability.md
```

The commands of one area, and what to know before running them, are in the rule file of that area (see Claude configuration).

## Running tests

- `pnpm test` runs the unit tests and the server integration tests (Vitest), then the tests of the build scripts and the lint rules.
- `pnpm test:e2e` runs the end-to-end tests in `e2e/` (Playwright).
- `pnpm test:e2e:parity` runs the UI parity check (`e2e/parity/`, Playwright in a container) and writes a report of where the app differs from the prototype; `e2e/parity/README.md` says how a ticket adds a screen to it.
- Every test file lives in a folder named `tests` at the root of its workspace, never beside the source it tests: `packages/<name>/tests/`, `apps/web/tests/`, `apps/server/tests/`, with a subfolder per area (`apps/server/tests/auth/`) and the helpers beside the tests that use them. The exceptions are `e2e/`, and the tests of a build script or a lint rule, which sit beside their tool in `scripts/`, `tools/` and `apps/web/scripts/`.

## Boundary rules

Three rules, enforced by lint (`pnpm lint`):

1. Server modules call each other only through public interfaces, never each other's tables. Lint bans importing another server module's file other than its public entry file.
2. `client-core` touches no DOM or browser API, so React Native can reuse it.
3. Components reach platform features only through `platform`. Lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web`; file picking cannot be caught by lint and relies on review.

The rules live only in `eslint.config.js` and `tools/lint-rules/`. Change a boundary there, nowhere else.

## Where documents live

| Path | Holds |
| :---- | :---- |
| `docs/intents/` | One intent per piece of work: the problem and the outcome wanted |
| `docs/specs/` | One spec per intent: requirements, design, testing, open concerns |
| `docs/plans/` | One implementation plan per ticket, `<KEY>.md` |
| `docs/qa/` | One QA record per ticket, `<KEY>.md`: the test matrix and its results |
| `docs/acceptance/` | One acceptance record per Blueprint outcome, `<slug>.md`, and one per milestone, `milestone-<m>.md` |
| `docs/ui-parity/` | The kept runs of the UI parity check, one folder each, and `index.md`, the list made by `pnpm ui:save` |
| `docs/traceability.md` | Generated by `trace.sh`: outcome, intent, spec, ticket, tests, acceptance |
| `docs/definition-of-done.md` | What "done" means for a ticket |
| `docs/ticket-config.yml` | Status names, labels and thresholds the cl skills read |
| `.github/pull_request_template.md` | The pull request template |
| `docs/adr/`, `docs/handoff/`, `docs/tickets/` | Written by the cl plugins when used: decisions, hand-off notes, ticket files |

A reference document (an inventory, a guide) is one file, `docs/<topic>.md`, for example `docs/environment-config.md`.

## Claude configuration

`.claude/settings.json` enables the `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` plugins from the `cl` marketplace, and sets the advisor model. It denies `gh pr merge`, force-push, `git branch -D` and the deletion of a remote branch; do not work around a denied command.

Rules are in `.claude/rules/`. `ticket.md` loads in every session: how a requirement becomes a ticket, the process, and the review of a pull request. The others load by area: `server`, `web`, `packages`, `typescript`, `specs`, `workflows` and `tooling` (scripts, tools, hooks).

The hooks in `.claude/hooks/` refuse a push or a pull request from a branch with no slug, refuse an edit of `pnpm-lock.yaml`, format a file after an edit, and notify when a turn ends, naming the tasks of the task list that the turn completed. The project command `/spec-check` checks a spec before its pull request.
