# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

The phase 1 tree. A folder marked "planned" does not exist yet; the ticket named delivers it.

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
├─ infra/            not created: TOKI-003 put the development compose file at the root, as `docker-compose.dev.yml`
├─ e2e/              planned (TOKI-008): Playwright end-to-end tests
└─ docs/             intents, specs, plans and reference documents
```

`apps/mobile`, `apps/desktop` and `packages/ui-native` belong to later phases and are not part of this tree.

# Working agreements

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

What Claude must not do in this repository, collected from rules that already exist. Each line names its source.

1. Merge a pull request, force-push, or push to `main`, `master`, `develop` or `release/*`. Source: Working agreements above.
2. Commit a secret or a `.env` file. Source: `docs/environment-config.md` ("Secrets live in `.env`, never in git") and `.gitignore`.
3. Import a file of another server module other than its public entry file `index.ts`. Source: lint rule `toki/module-entry`; `docs/specs/2026-11-12-server-skeleton-design.md`, R17.
4. Use a DOM or browser API in `client-core`, `shared`, `i18n` or `tokens`. Source: lint rule `toki/client-core-globals`.
5. Use the notification, storage, service worker or audio API directly in `ui-web`, instead of going through `platform`. Source: lint rule `toki/platform-apis`.
6. Add a tool that runs code to the `PR review` workflow, or put text from a comment or a pull request into a `run:` script other than through `env:`. Source: Review on request below.
7. Hard-code a tracker status name instead of the logical keys of `docs/ticket-config.yml`. Source: From a requirement to a ticket below.
8. Work around a command that `.claude/settings.json` denies. Source: Claude configuration below.

## State of the repository

The repository is built ticket by ticket, starting from workflow files and documents only. The pnpm workspace, the two apps and the six packages arrive with TOKI-001, and each later foundation ticket adds its own folders and commands. Check the tree for what exists; a folder or command named in a spec may not be built yet. The ticket that adds a command also adds it to the Commands section below.

Until a piece of code exists, its spec in `docs/specs/` is the source of truth for what it will look like. Read the spec of the ticket you work on; do not infer the structure from another ticket's spec.

## From a requirement to a ticket

Work reaches development through documents, not through tickets written by hand:

1. An intent, `docs/intents/<slug>.md`: problem, proposed outcome, affected users and systems, constraints, open questions.
2. A spec, `docs/specs/<date>-<slug>-design.md`. Its header carries an `Intent:` line with the path of the intent and a `Ticket:` line with the key (`TOKI-NNN`). Its body has the requirements (`R1`, `R2`, ...), the design, the testing, a table of how each constraint of the intent is met, "Open questions from the intent" and "Areas of concern".
3. Intent and spec go to `main` in one pull request on the branch `spec/<slug>`.
4. When that pull request is merged, the `Spec ticket` workflow (`.github/workflows/spec-ticket.yml`) gives each spec it touches a GitHub issue titled `<intent title> (<KEY>)`, created when missing. `.github/scripts/spec-ready.sh` decides the status without a network call or a model: a spec with no open question or concern gets the `accepted` status, and a spec with one gets the `blocked` status and a comment that lists what is open. An issue that is closed, or already in development or later, is left alone. A spec with no `Ticket:` line or no intent file gets no ticket; the gaps go into a comment on the pull request.
5. Development of the ticket happens on its ticket branch, with its plan in `docs/plans/<KEY>.md` (the first development ticket creates the folder).

The wording of a spec is therefore read by a script. To be ready, a spec needs all of:

- a `Ticket:` line, an `Intent:` line whose file exists, and a Requirements section;
- in every numbered item of "Areas of concern", one of "Decided", "Answered", "Accepted" or "Settled" (capitalised; "Answered in part" does not count), placed after the item's last open marker ("Not decided", "Not answered", "not a decision", "Still open", in any case). An item with no open marker still needs the decision word;
- for every line of "Open questions from the intent" that says "Not answered", a reference to an existing "concern N".

`spec-ready.sh` and its test file `spec-ready.test.sh` hold the exact rule.

`docs/ticket-config.yml` maps the logical statuses (`intent`, `blocked`, `spec-review`, `accepted`, `in-dev`, `in-review`, `in-qa`, `done`) to the names on the tracker, and holds the labels and the thresholds the cl skills read. Use the logical keys; do not hard-code a tracker name.

## Commands

Run from the repository root.

```bash
# Rewrite packages/tokens/src/tokens.css from the token objects (the test of the package fails when the file is stale)
pnpm --filter @toki/tokens generate

# Test the tokens package
pnpm --filter @toki/tokens test

# Test the readiness rule (the workflow runs this before it touches a ticket)
bash .github/scripts/spec-ready.test.sh

# Check one spec: exit 0 ready, exit 1 gaps (one "- " line each), exit 2 wrong usage
bash .github/scripts/spec-ready.sh docs/specs/<file>.md

# Print what the workflow would write for one spec, without writing it.
# It reads the issues first: needs jq, network access and an authenticated gh.
# It prints "left alone" and no DRY-RUN line when the ticket needs no change.
DRY_RUN=1 bash .github/scripts/spec-ticket.sh docs/specs/<file>.md

# Test the Claude hooks (branch slug, lock file, format): feeds each hook a tool call and checks the exit code
bash .claude/hooks/hooks.test.sh

# Test the lint rules: the name on an icon-only button (the 36 cases of TOKI-012) and the import ban on the web implementation of platform (TOKI-018)
pnpm test:lint-rules

# Test the platform package (storage, notifications, file picking, sound)
pnpm --filter @toki/platform test

# Test the base components of ui-web
pnpm --filter @toki/ui-web test

# Check that no dev-only page (the component preview) is in the web build (run last by the web build; a dist folder can be given with `-- --dist <dir>`)
pnpm --filter @toki/web run check:no-dev-pages

# Open the component preview page of the design system (development server only)
pnpm --filter @toki/web dev   # then http://localhost:5173/preview.html?look=calm&accent=teal

# Test the rule that reads a review request from a comment
bash .github/scripts/review-request.test.sh

# Read one comment: exit 0 when it mentions @reviewer, exit 1 when it does not ask for a review
printf '%s' '@reviewer' | bash .github/scripts/review-request.sh

# Lint the whole repository (ESLint; a warning fails too), under Node 22
pnpm lint

# Check the format (Prettier), or rewrite badly formatted files
pnpm format:check
pnpm format

# Start Postgres, MinIO and Mailpit and wait until all three are healthy (needs Docker and a root .env).
# The first run builds the MinIO image from source: a few minutes and about 3 GB of free Docker disk.
pnpm dev:up

# Stop the three services; their data stays in the named volumes
pnpm dev:down

# Wipe development data: all three stores, or one. Each refuses unless NODE_ENV is development.
# dev:reset:db then applies every migration, so the tables exist and hold no row.
pnpm dev:reset
pnpm dev:reset:db
pnpm dev:reset:files
pnpm dev:reset:mail

# Create a migration from a change to the table definitions in apps/server/src/modules/*/schema.ts.
# Commit the whole apps/server/migrations/ folder (the SQL file and meta/).
pnpm db:generate

# Apply every pending migration to the database in DATABASE_URL (reads the root .env when it exists).
# Needs the services up for development. See apps/server/src/db/README.md.
pnpm db:migrate

# Test the reset scripts. Part 1 (the guard) needs no Docker; part 2 needs the services up
# and WIPES the development data. Run it whenever a script in scripts/ changes.
bash scripts/smoke.test.sh
```

The `Spec ticket` workflow can also be run by hand on GitHub, for one spec or for all, with a `dry_run` input.

## Common commands

The root `pnpm` scripts, run from the repository root under Node 22 (`.nvmrc`). The workflow scripts are in Commands above.

| Command | What it does | Status |
| :---- | :---- | :---- |
| `pnpm install` | Install the workspace | works (TOKI-001) |
| `pnpm typecheck` | Type-check every package | works (TOKI-001) |
| `pnpm lint` | ESLint, including the boundary rules; a warning fails | works (TOKI-002) |
| `pnpm format`, `pnpm format:check` | Prettier: rewrite, or check only | works (TOKI-002) |
| `pnpm dev` | Run the `dev` script of each package that has one | works (TOKI-001) |
| `pnpm dev:up`, `pnpm dev:down` | Start or stop Postgres, MinIO and Mailpit | works (TOKI-003) |
| `pnpm dev:reset`, `pnpm dev:reset:db`, `pnpm dev:reset:files`, `pnpm dev:reset:mail` | Wipe development data; `dev:reset:db` also applies the migrations | works (TOKI-003, TOKI-005) |
| `pnpm db:generate`, `pnpm db:migrate` | Create a migration from the table definitions; apply every pending migration | works (TOKI-005) |
| `pnpm test`, `pnpm test:e2e` | Run the tests (see Running tests) | planned (TOKI-008) |

## Running tests

- `pnpm test` runs the unit tests and the server integration tests (Vitest).
- `pnpm test:e2e` runs the end-to-end tests in `e2e/` (Playwright).
- Neither exists yet: both are planned (TOKI-008). Until then a ticket is checked by the steps in its spec's Testing section.
- Every test file lives in a folder named `tests`, never beside the source it tests. A package keeps them in `packages/<name>/tests/` (`apps/web/tests/` for the web app), a server module in `apps/server/src/modules/<module>/tests/` (inside the module, so the boundary rule of lint allows the test to import the module's own files), and a test that spans modules in `apps/server/src/tests/`. Test helpers sit in the same `tests` folder as the tests that use them. A new test goes there; an older test that sits elsewhere moves when its ticket touches it.

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

A reference document (an inventory, a guide) is one file, `docs/<topic>.md`. TOKI-096 uses this for `docs/environment-config.md`.

## Process

Work goes intent -> spec -> ticket (see "From a requirement to a ticket"). Work with no accepted intent starts by writing one; do not start on code.

A pull request that creates a folder or command which this file marks as planned or not created removes that mark in the same pull request.

## Review on request

A comment that mentions `@reviewer` on an open pull request starts the `PR review` workflow (`.github/workflows/pr-review.yml`), which reviews the pull request with Claude. The review instructions are the `prompt` of its last step. The review posts inline comments and one summary comment that ends with a `<!-- review:{"sha":...} -->` marker. It never approves or merges.

The same review also starts, with no comment, when a pull request is opened or marked ready for review by the owner, a member or a collaborator of the repository (`pull_request_target`, `opened` and `ready_for_review`). A draft, a bot's pull request and a pull request from anyone else wait for a `@reviewer` comment. A push to an open pull request does not start a review. The trigger runs the file on `main`, so a change to `pr-review.yml` takes effect only after it is merged.

Anyone may ask, so the run treats the pull request as untrusted: the workspace is `main`, the head of the pull request is only read under `pr-head/`, and Claude has read and comment tools only. Keep it that way when you change the workflow: do not add a tool that runs code, and do not put text from a comment or a pull request into a `run:` script except through `env:`.

The workflow needs the repository secret `CLAUDE_CODE_OAUTH_TOKEN`. Like every `issue_comment` workflow, it runs the version on `main`, not the one on the pull request.

## Claude configuration

`.claude/settings.json` enables the `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` plugins from the `cl` marketplace, and sets the advisor model. It denies `gh pr merge`, force-push, `git branch -D` and the deletion of a remote branch; do not work around a denied command.

A `Stop` hook runs `.claude/hooks/notify-on-finish.sh`, which shows a desktop notification when Claude finishes a turn (`osascript` on macOS, `notify-send` on Linux, nothing elsewhere). It runs in the background and always exits 0.

Three more hooks run in this repository: `.claude/hooks/check-branch-slug.sh` refuses `git push` and `gh pr create` from a branch with no slug (for example `feat/toki-002`; rename it first), `.claude/hooks/block-lockfile-edit.sh` refuses an Edit or Write of `pnpm-lock.yaml` (not a change made through the shell), and `.claude/hooks/format-after-edit.sh` runs Prettier on a file after an edit and never fails the call. Rules that load by area are in `.claude/rules/` (`server`, `web`, `packages`, `typescript`, `specs`, `workflows`), and the project command `/spec-check` checks a spec before its pull request.
