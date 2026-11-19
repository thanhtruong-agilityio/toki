# CLAUDE.md

## What the project is

Toki is an internal team chat for one company: channels, direct messages, threads and files, and later tasks, calendar, video meetings, a guest portal, automations, mail and AI summaries.

- Single-tenant and self-hosted: each company runs its own copy on its own server.
- Built in phases by one person working with Claude. Phase 1 is core chat on the web.
- The prototype is the only design source.

## Read first

Read these, in this order, before you start work on a ticket:

1. The intent of the work in hand: `docs/intents/<slug>.md`.
2. Its spec: `docs/specs/<date>-<slug>-design.md`.
3. `docs/definition-of-done.md`.

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

There is no `infra/` folder: the development compose file is `docker-compose.dev.yml` at the root. `apps/mobile`, `apps/desktop` and `packages/ui-native` belong to later phases.

The repository is built ticket by ticket. Check the tree for what exists: a folder or command named in a spec may not be built yet. For code that does not exist yet, the spec of your ticket is the source of truth; do not infer the structure from another ticket's spec.

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

Each line names its source.

1. Merge a pull request, force-push, or push to `main`, `master`, `develop` or `release/*`. Source: Working agreements above.
2. Commit a secret or a `.env` file. Source: `docs/environment-config.md` ("Secrets live in `.env`, never in git") and `.gitignore`.
3. Import a file of another server module other than its public entry file `index.ts`. Source: lint rule `toki/module-entry`; `docs/specs/2026-11-12-server-skeleton-design.md`, R17.
4. Use a DOM or browser API in `client-core`, `shared`, `i18n` or `tokens`. Source: lint rule `toki/client-core-globals`.
5. Use the notification, storage, service worker or audio API directly in `ui-web`, instead of going through `platform`. Source: lint rule `toki/platform-apis`.
6. Add a tool that runs code to the `PR review` workflow, or put text from a comment or a pull request into a `run:` script other than through `env:`. Source: `.claude/rules/workflows.md`.
7. Hard-code a tracker status name instead of the logical keys of `docs/ticket-config.yml`. Source: From a requirement to a ticket below.
8. Work around a command that `.claude/settings.json` denies. Source: Claude configuration below.

## From a requirement to a ticket

Work reaches development through documents, not through tickets written by hand:

1. An intent, `docs/intents/<slug>.md`: problem, proposed outcome, affected users and systems, constraints, open questions.
2. A spec, `docs/specs/<date>-<slug>-design.md`. Its header carries an `Intent:` line with the path of the intent and a `Ticket:` line with the key (`TOKI-NNN`). Its body has the requirements (`R1`, `R2`, ...), the design, the testing, a table of how each constraint of the intent is met, "Open questions from the intent" and "Areas of concern".
3. Intent and spec go to `main` in one pull request on the branch `spec/<slug>`.
4. When that pull request is merged, the `Spec ticket` workflow (`.github/workflows/spec-ticket.yml`) gives each spec a GitHub issue titled `<intent title> (<KEY>)`: status `accepted` when the spec is ready, `blocked` with a comment that lists what is open when it is not.
5. Development of the ticket happens on its ticket branch, with its plan in `docs/plans/<KEY>.md`.

A script reads the wording of a spec to decide whether it is ready. The wording rule is in `.claude/rules/specs.md`; the exact rule is `.github/scripts/spec-ready.sh`. Check a spec with `/spec-check` before its pull request.

`docs/ticket-config.yml` maps the logical statuses (`intent`, `blocked`, `spec-review`, `accepted`, `in-dev`, `in-review`, `in-qa`, `done`) to the names on the tracker, and holds the labels and the thresholds the cl skills read. Use the logical keys; do not hard-code a tracker name.

## Common commands

The root `pnpm` scripts, run from the repository root under Node 22 (`.nvmrc`) with the pnpm version of `package.json`.

| Command | What it does |
| :---- | :---- |
| `pnpm install` | Install the workspace |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | ESLint, including the boundary rules; a warning fails |
| `pnpm format`, `pnpm format:check` | Prettier: rewrite, or check only |
| `pnpm test`, `pnpm test:e2e` | Run the tests (see Running tests) |
| `pnpm build`, `pnpm size` | Build every package; check the bundle size against `tools/bundle-size/limit.json` |
| `pnpm i18n:check` | Check the vi and en translations |
| `pnpm dev` | Run the `dev` script of each package that has one |
| `pnpm dev:up`, `pnpm dev:down` | Start Postgres, MinIO and Mailpit and wait until healthy (needs Docker and a root `.env`; the first run builds MinIO from source: a few minutes, about 3 GB of Docker disk), or stop them and keep their data |
| `pnpm dev:reset`, `pnpm dev:reset:db`, `pnpm dev:reset:files`, `pnpm dev:reset:mail` | Wipe development data, all stores or one; each refuses unless `NODE_ENV` is `development`. `dev:reset:db` then applies every migration |
| `pnpm db:generate` | Create a migration from a change to `apps/server/src/modules/*/schema.ts`. Commit the whole `apps/server/migrations/` folder |
| `pnpm db:migrate` | Apply every pending migration to `DATABASE_URL` (needs the services up). See `apps/server/src/db/README.md` |

## Commands

Commands that are not in the table above. Run from the repository root.

```bash
# One package: test, or any script of its package.json
pnpm --filter @toki/<name> test

# Rewrite packages/tokens/src/tokens.css from the token objects (the package test fails when the file is stale)
pnpm --filter @toki/tokens generate

# Component preview page of the design system (development server only)
pnpm --filter @toki/web dev   # then http://localhost:5173/preview.html?look=calm&accent=teal

# Check that no dev-only page is in the web build (run last by the web build; `-- --dist <dir>` for another folder)
pnpm --filter @toki/web run check:no-dev-pages

# Test the lint rules
pnpm test:lint-rules

# Test the Claude hooks
bash .claude/hooks/hooks.test.sh

# Test the reset scripts. Part 2 needs the services up and WIPES the development data.
# Run it whenever a script in scripts/ changes.
bash scripts/smoke.test.sh

# Check one spec before its pull request (exit 0 ready, 1 gaps, 2 wrong usage)
bash .github/scripts/spec-ready.sh docs/specs/<file>.md
```

The commands that test the workflow scripts are in `.claude/rules/workflows.md`.

## Running tests

- `pnpm test` runs the unit tests and the server integration tests (Vitest), then the tests of the build scripts and the lint rules.
- `pnpm test:e2e` runs the end-to-end tests in `e2e/` (Playwright).
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
| `docs/definition-of-done.md` | What "done" means for a ticket |
| `docs/ticket-config.yml` | Status names, labels and thresholds the cl skills read |
| `.github/pull_request_template.md` | The pull request template |
| `docs/adr/`, `docs/handoff/`, `docs/tickets/` | Written by the cl plugins when used: decisions, hand-off notes, ticket files |

A reference document (an inventory, a guide) is one file, `docs/<topic>.md`, for example `docs/environment-config.md`.

## Process

Work goes intent -> spec -> ticket (see "From a requirement to a ticket"). Work with no accepted intent starts by writing one; do not start on code.

A pull request that adds a command adds it to this file: a root script to Common commands, any other to Commands. A pull request that creates a folder or command which this file marks as planned removes that mark.

## Review on request

The `PR review` workflow (`.github/workflows/pr-review.yml`) reviews a pull request with Claude. It starts when a comment on an open pull request mentions `@reviewer`, and by itself when the owner, a member or a collaborator opens a pull request or marks it ready for review. It posts inline comments and one summary comment; it never approves or merges. A push to an open pull request does not start a review.

The run treats the pull request as untrusted. The rules for changing the workflow are in `.claude/rules/workflows.md`.

## Claude configuration

`.claude/settings.json` enables the `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` plugins from the `cl` marketplace, and sets the advisor model. It denies `gh pr merge`, force-push, `git branch -D` and the deletion of a remote branch; do not work around a denied command.

Hooks in `.claude/hooks/`:

- `check-branch-slug.sh` refuses `git push` and `gh pr create` from a branch with no slug (for example `feat/toki-002`). Rename the branch before its pull request is opened; a later rename closes the pull request.
- `block-lockfile-edit.sh` refuses an Edit or Write of `pnpm-lock.yaml`; change it through `pnpm`.
- `format-after-edit.sh` runs Prettier on a file after an edit.
- `notify-on-finish.sh` shows a desktop notification when a turn ends.

Rules that load by area are in `.claude/rules/` (`server`, `web`, `packages`, `typescript`, `specs`, `workflows`). The project command `/spec-check` checks a spec before its pull request.
