# Rules, hooks and a spec check for Claude design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/claude-rules-and-hooks.md (Thanh Truong)
Ticket: TOKI-105

## Goal
Toki is built by one person working with Claude. `CLAUDE.md` describes the project and its process, but what Claude must never do is spread over several sections, the conventions of each area of the code are not written where Claude meets those files, and nothing in the repository stops the common mistakes before they happen. This work adds one "never do" list, a few rules that load by area, three hooks and one command, all taken from rules the repository already has.

## Scope
- In: a section `## Never do` in `CLAUDE.md`; rule files in `.claude/rules/`; hook scripts in `.claude/hooks/` and their entries in `.claude/settings.json`; one project command in `.claude/commands/`.
- Out (not now):
  - A command that creates a server module (decided, concern 3).
  - A hook that blocks `.env` or secrets: the cl-core plugin already ships `block-secrets` and `block-prompt-secrets`.
  - Any change to the 14 allow rules and 6 deny rules of `.claude/settings.json`.
  - Changing the text of the TOKI-095 spec. This spec replaces its R12 and concern 2 and says so (concern 5).
  - Lint rules, CI and test code.

## Requirements
- R1. `CLAUDE.md` has a section `## Never do`, placed after "Working agreements", with one line per item, and each line names where the rule comes from. The eight items are: (1) merge a pull request, force-push, or push to `main`, `master`, `develop` or `release/*` (Working agreements); (2) commit a secret or a `.env` file (the Blueprint rule that secrets live in `.env`, never in git, as carried in the TOKI-095 spec, Data safety); (3) import another server module's file other than its public entry file `index.ts` (lint rule `toki/module-entry`; server-skeleton spec R17); (4) use a DOM or browser API in `client-core`, `shared`, `i18n` or `tokens` (lint rule `toki/client-core-globals`); (5) use the notification, storage, service worker or audio API directly in `ui-web`, instead of going through `platform` (lint rule `toki/platform-apis`); (6) add a tool that runs code to the `PR review` workflow, or put text from a comment or a pull request into a `run:` script other than through `env:` (CLAUDE.md, Review on request); (7) hard-code a tracker status name instead of the logical keys of `docs/ticket-config.yml` (CLAUDE.md, From a requirement to a ticket); (8) work around a command that settings deny (CLAUDE.md, Claude configuration).
- R2. The "never delete a branch without asking" rule is not in the list. The line "Ask before every branch deletion and deploy" stays in "Working agreements" and is not copied.
- R3. These six rule files exist, each opening with a `paths:` list of globs so that it loads when Claude works on a matching file: `server.md` (`apps/server/**`), `web.md` (`apps/web/**` and `packages/ui-web/**`), `packages.md` (`packages/**`), `typescript.md` (`**/*.ts` and `**/*.tsx`), `specs.md` (`docs/specs/**` and `docs/intents/**`), `workflows.md` (`.github/workflows/**` and `.github/scripts/**`). Each file is at most 60 lines.
- R4. Every statement in a rule file has a source, named in one line after it, and the source is one of two kinds: (a) a merged spec, the lint configuration, `CLAUDE.md` or a workflow of this repository; (b) the official documentation of the tool, given as a link (concern 2). A statement of kind (b) sits in a section `External standard` of its file, apart from the statements of kind (a), so a reader can tell a rule of this project from a rule of the tool. A rule file holds no statement without a source. Check: for each statement, the source line exists, and each link opens the page that makes the statement.
- R5. Content by file. The statements below are the minimum; each file may hold more that meet R4. (1) `server.md`, kind (a): configuration is read in one module; every error body uses the one schema of `packages/shared`; routes live under `/api/v1`; the only public entry of a module is its `index.ts`. Kind (b): a route plugin stays encapsulated and `fastify-plugin` wraps only what other plugins share, such as the database connection ([Fastify, Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/)); validation error details are in the response by default, so the error handler decides what to expose ([Fastify, Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)); store a moment in time as `timestamptz`, not `timestamp`, and text as `text`, not `varchar(n)` ([PostgreSQL wiki, Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This)). (2) `web.md`, kind (a): routes are defined in code under `apps/web/src/routes/`; there is one Query client; platform features go through `platform`. Kind (b): do not use an Effect to compute a value from props or state, compute it while rendering; keep what an interaction causes in the event handler; reset a component's state with a `key`; subscribe to an external store with `useSyncExternalStore` ([React, You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)). (3) `packages.md`, kind (a): the three boundary rules as lint enforces them. Kind (b): data of type `unknown` is parsed with its Zod schema where it enters the system, and the type is taken with `z.infer` from that schema, not written twice ([Zod, Basics](https://zod.dev/basics)). (4) `typescript.md`, kind (a): `strict` is on in `tsconfig.base.json`. Kind (b): `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not part of `strict` and are not turned on here ([TypeScript, TSConfig Reference](https://www.typescriptlang.org/tsconfig/)).
- R6. `specs.md` states the readiness rule of `CLAUDE.md` (a `Ticket:` line, an `Intent:` line, every concern closed with "Decided", "Answered", "Accepted" or "Settled") and points to `.github/scripts/spec-ready.sh` for the exact rule. It does not copy the script.
- R7. The branch-slug hook is `.claude/hooks/check-branch-slug.sh`, registered as a `PreToolUse` hook on `Bash` in `.claude/settings.json`. It refuses (exit code 2, with a message on standard error) a command that contains `git push` or `gh pr create` when the current branch name matches `<type>/<ticket>` with no slug, for example `feat/toki-002`, and lets every other command through. The message tells how to rename the branch.
- R8. The lock-file hook is `.claude/hooks/block-lockfile-edit.sh`, registered as a `PreToolUse` hook on `Edit` and `Write`. It refuses (exit code 2) a tool call whose target file is `pnpm-lock.yaml` and lets every other file through. The message says that `pnpm install` rewrites this file.
- R9. The format hook is `.claude/hooks/format-after-edit.sh`, registered as a `PostToolUse` hook on `Edit` and `Write`. For a file with one of the extensions `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `json` or `css` that `.prettierignore` does not exclude, it runs Prettier in write mode on that file only. It never fails the tool call: whatever happens, it exits 0 (concern 4).
- R10. Each of the three hook scripts reads the tool call as JSON on standard input and uses no path outside `$CLAUDE_PROJECT_DIR`.
- R11. The command `/spec-check` exists as `.claude/commands/spec-check.md`. Given a spec path, it runs `bash .github/scripts/spec-ready.sh <path>` and reports the result: ready, or the list of gaps. With no argument it checks the specs changed on the current branch against `main`. It writes nothing.
- R12. `.claude/settings.json` keeps its keys and its 14 allow and 6 deny rules unchanged, and keeps the existing `Stop` hook. The change to the file adds only the three hook entries of R7 to R9. Check: `git diff main -- .claude/settings.json` shows added lines only.
- R13. `CLAUDE.md` changes by added lines only, and holds the branch format rule once. The added lines are the section of R1 and one line in "Claude configuration" that lists the three hooks, the rule files and the command.
- R14. No committed file holds a secret, a token or a path under `/Users/` or `/home/`.

## Design
### Layout
```
toki/
├─ CLAUDE.md                        + ## Never do; + one line in Claude configuration
└─ .claude/
   ├─ settings.json                 + three hook entries
   ├─ rules/                        server.md  web.md  packages.md  typescript.md  specs.md  workflows.md
   ├─ hooks/                        check-branch-slug.sh  block-lockfile-edit.sh  format-after-edit.sh
   └─ commands/                     spec-check.md
```
- The branch-slug hook is the script of commit `503ed94`, which was never merged to `main`. It is taken from there. That commit also added a line to "Working agreements" about `dev-state claim`; this work does not bring it back (R13), because the "never do" list and the hook message already say what to do.
- The two new hooks follow the same shape: read the JSON, decide, exit 2 with a message to refuse, exit 0 to allow.
- The format hook uses the Prettier of the repository (`pnpm exec prettier`). If Prettier cannot run in the hook environment, the hook ends silently with exit 0, and `pnpm format:check` in CI stays the real check.
- The external standards of R5 were checked on 2026-11-17 against the official pages named there. They are statements of those pages, not new rules of this project; the project follows them by decision of Thanh (concern 2).
- Assumption: rule files with a `paths:` header load only when Claude reads or edits a matching file, as Claude Code documents for `.claude/rules/`. The check is in Testing.
- Assumption: the project command is a Markdown file in `.claude/commands/`, which Claude Code lists as a slash command.

## Testing
- No application code is added. Hook scripts are tested by feeding them JSON on standard input, with the exit code and the message checked:
  - R7: a `Bash` call `git push` on a branch named `feat/toki-002` exits 2 with the rename message; on `docs/toki-095-claude-md-sections` it exits 0; `gh pr create` behaves the same; `git status` exits 0 on any branch.
  - R8: an `Edit` call on `pnpm-lock.yaml` exits 2; on `package.json` it exits 0.
  - R9: a `Write` call on a `.ts` file that is badly formatted leaves it formatted; on a `.md` file, or a file in `.prettierignore`, it changes nothing; with Prettier missing from the path, it exits 0.
  - R10: a search of the three scripts finds no absolute path.
- The tests are one script, `.claude/hooks/hooks.test.sh`, run by hand with `bash .claude/hooks/hooks.test.sh`, in the style of `.github/scripts/spec-ready.test.sh`. It is added to the Commands section of `CLAUDE.md` by this work (R13).
- R3, R4, R5, R6: read each rule file against its sources; the check of R4 is a list in the pull request description, one line per statement with its source.
- R3 loading: in a fresh session, open a file under `apps/server/` and confirm Claude lists `server.md` as loaded.
- R11: run `/spec-check` on a ready spec (exit "ready") and on a copy with a concern left open (the gap is listed).
- R12, R13: `git diff main -- CLAUDE.md .claude/settings.json` shows added lines only. R14: a search for `/Users/` and `/home/` in the changed files finds nothing.
- Definition of done: the written checks and `hooks.test.sh` count as the test. CI does not exist yet, so the CI item is waived until TOKI-007, as for TOKI-095.

## Data safety
- All files are committed, so they hold no secret, token or personal path (R14). Hook scripts read the tool call from standard input and write only to standard error; they log nothing to a file.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Every item comes from a rule that already exists in the repository or in the official documentation of the tool | R1 (a source on each line), R4 (a source for each statement, kind (a) or (b)) |
| A hook must not duplicate one that the cl-core plugin ships | Scope, Out: no secrets or `.env` hook; R7 to R9 cover slug, lock file and format, which no cl-core hook covers |
| Nothing is added for code that does not exist yet | Scope, Out: no module command (concern 3). `server.md` and `web.md` are written now from the merged skeleton specs and the official standards (concern 2) |
| The change adds to `CLAUDE.md` and `.claude/settings.json` and removes nothing | R12, R13 |
| The two permission lists on `main` (14 allow, 6 deny) stay as they are | R12 |
| "Never delete a branch without asking" is not part of the list | R2 |
| No secret, token or personal path in any committed file | R14, Data safety |

## Open questions from the intent
- Which hooks exactly. Answered: branch slug, lock file and format. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. See concern 4.
- Which area rules to write now. Answered: server, web, packages, typescript, specs and workflows, with the official standards added. Decided by Thanh on 2026-11-17. See concern 2.
- Which project command to ship now. Answered: `/spec-check`; the module command stays out. Decided by Thanh on 2026-11-17. See concern 3.
- The ticket key. Answered: TOKI-105. See concern 1.

## Areas of concern
1. The ticket key. Answered: TOKI-105. Evidence: the Blueprint ticket list uses keys up to TOKI-104 (TOKI-102 to TOKI-104: notification preferences, disk-space warning, update-available strip), and the issues on the repository use keys up to TOKI-101 (`gh issue list`, 2026-11-17), so TOKI-105 is the next free key. The key is written into the spec header in Publish. Owner: Thanh Truong.
2. `server.md` and `web.md` describe code that is still a skeleton (`apps/server/src/index.ts` only), and the intent said no rule is invented. Answered: both files are written now. Their statements come from the merged server and web skeleton specs, from the lint configuration and from the official documentation of Fastify, PostgreSQL, React and Zod; `packages.md` and `typescript.md` use the same two kinds of source. The official standards sit in a section `External standard` with a link on each statement (R4, R5), and the intent constraint is changed from "no new rule is invented" to "every item has a source in the repository or in the official documentation". Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Nothing open. Owner: Thanh Truong.
3. The module command `/new-server-module`. Answered: it stays out of this spec; it is added when a later intent asks for it. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Nothing open. Owner: Thanh Truong.
4. The format hook runs Prettier on every edit and needs Node 22 and `pnpm` in the hook environment. Answered: the hook is kept. R9 makes it silent on failure, and `pnpm format:check` in CI stays the real check. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Nothing open. Owner: Thanh Truong.
5. This spec replaces R12 and concern 2 of the TOKI-095 spec ("no new hook"). Answered: no note is added to the TOKI-095 spec; it stays as it is on `main`, and only this spec says that it replaces R12. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Nothing open. Owner: Thanh Truong.
