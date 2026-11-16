# Claude project setup design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/claude-project-setup.md (Thanh Truong)
Ticket: TOKI-095

## Goal
Toki is built by one person working with Claude. Today the project context and the agreed process must be explained again in each Claude session. This work sets up the repository so a new session knows what the project is, what to read first, the branch and commit conventions and how to run tests, and follows intent -> spec -> ticket without being told.

## Scope
- In: extending the root `CLAUDE.md` and the project `.claude/settings.json` that already exist on `main` (written by `/cl-core:setup`, merged in PR #11; the permission rules and two working agreements were added by PR #13 and PR #14); the folders `docs/intents`, `docs/specs`, `docs/plans`. `.claude/settings.json` gets no new permission rule and no new hook: it keeps what `main` holds (PR #13 settings; the plugin hooks come from the cl-core plugin) (R12, concern 2). This work adds to the two existing files and removes or replaces nothing in them (R16).
- Out (not now):
  - The Blueprint sources. They are not pushed to `main`; PR #12 is out of scope. The Blueprint stays an external source outside the repository (concern 4).
  - Creating the monorepo, apps and packages: TOKI-001.
  - ESLint, Prettier and lint enforcement of the boundary rules: TOKI-002. This spec only writes the rules down.
  - Docker Compose and the `dev:*` scripts: TOKI-003.
  - CI on GitHub Actions: TOKI-007.
  - The test harness and the test commands themselves: TOKI-008.
  - The environment variable inventory, `.env.example` and how secrets are kept: TOKI-096.
  - The `dev:seed` script: TOKI-081. The installation guide: TOKI-087.
  - The PR template, `docs/definition-of-done.md` and `docs/ticket-config.yml`, which PR #11 also added: already on `main`, not changed here. Only R6 names them.
  - Personal settings (`.claude/settings.local.json`, user-level settings) and any change to the cl plugins themselves.
  - Creating the GitHub ticket for TOKI-095. The intent does not ask for it.

## Requirements
- R1. `CLAUDE.md` at the repository root has a section "What the project is" that states, from the Blueprint: internal team chat for one company, single-tenant and self-hosted, built in phases, phase 1 is core chat on the web, and the prototype is the only design source.
- R2. `CLAUDE.md` has a section "Read first" that lists, in order, the documents a new session must read, each as a path or a path pattern, never a whole folder, and only documents that exist on `main`: the intent `docs/intents/<slug>.md` and the spec `docs/specs/<date>-<slug>-design.md` of the work in hand, then `docs/definition-of-done.md`. `CLAUDE.md` does not list itself and does not point to the Blueprint as a path in the repository. Check: every fixed path in the list exists; each pattern matches at least one file.
- R3. `CLAUDE.md` has a section "Repository layout" that shows the phase 1 tree from the Blueprint (`apps/server`, `apps/web`, the six packages, `infra`, `e2e`, `docs`). Each folder that does not exist yet is marked with the ticket that creates it.
- R4. `CLAUDE.md` has a section "Common commands". Each command is one that the Blueprint names or that the spec of the delivering ticket defines: `pnpm install` and `pnpm typecheck` (TOKI-001), `pnpm lint`, `pnpm lint:boundaries`, `pnpm format` and `pnpm format:check` (TOKI-002), `pnpm dev`, `pnpm dev:up`, `pnpm dev:down` and the `pnpm dev:reset*` scripts (TOKI-001 and TOKI-003), `pnpm test` and `pnpm test:e2e` (TOKI-008). Each command that does not work yet is marked with the ticket that delivers it. A command that no Blueprint text and no spec names is not listed.
- R5. `CLAUDE.md` has a section "Boundary rules" that states the three rules in the wording of the Blueprint Technical design tab ("Three boundary rules, enforced by lint"): (1) "Server modules call each other only through public interfaces, never each other's tables." (2) "`client-core` touches no DOM or browser API, so React Native can reuse it." (3) "Components reach platform features only through `platform`." It adds that lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web`, and that file picking cannot be caught by lint and is checked by review. The Blueprint is the external source of this wording; `CLAUDE.md` carries the wording itself and gives no repository path for the Blueprint. It also says how rule 1 is checked by lint: no import of another server module's file other than its public entry file (TOKI-002).
- R6. `CLAUDE.md` has a section "Where documents live" that names, with one line on what each holds: `docs/intents`, `docs/specs`, `docs/plans`, `docs/definition-of-done.md`, `docs/ticket-config.yml`, `.github/pull_request_template.md`, and the folders the cl plugins write to when used (`docs/adr`, `docs/handoff`, `docs/tickets`). It states the rule for other documents: a reference document (an inventory, a guide) is one file `docs/<topic>.md`; this is the place that TOKI-096 uses for `docs/environment-config.md`.
- R7. `CLAUDE.md` states the branch name format and the commit message format once, in the existing "Working agreements" section (branch `<type>/<ticket>-<slug>`, Conventional Commits with a lowercase subject), and this work adds one example of each there. The rule is not written a second time elsewhere in the file.
- R8. `CLAUDE.md` has a section "Running tests" that says which command runs which kind of test: `pnpm test` runs the unit tests and the server integration tests, `pnpm test:e2e` runs the end-to-end tests, both marked with TOKI-008 until that ticket delivers them.
- R9. `CLAUDE.md` has a section "Process" that states the order intent -> spec -> ticket and says that work without an accepted intent starts by writing one. It also states the rule: a pull request that creates a folder or command which `CLAUDE.md` marks as planned removes that mark in the same pull request. The work of removing the marks is TOKI-095's, done through this rule; the specs that deliver those items do not carry that line (concern 8).
- R10. The folders `docs/intents`, `docs/specs` and `docs/plans` exist in a fresh clone of the repository.
- R11. `.claude/settings.json` is committed, is valid JSON and enables the cl plugins `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` from the `cl` marketplace. Check: in a fresh clone, by a person who has access to the private marketplace repository, a new session lists the cl skills after that person accepts Claude Code's own prompts to trust the folder and install the marketplace; no other manual step is needed.
- R12. `.claude/settings.json` keeps the 14 `permissions.allow` rules and 6 `permissions.deny` rules that `main` already holds (PR #13) and adds no permission rule and no hook (decided, concern 2). The hooks that the cl-core plugin ships (`block-secrets`, `block-main`, `block-prompt-secrets`, the session-start routing) are not repeated in the file. The file contains no secret, token or personal path. Check: see Testing, R12.
- R13. Dropped on 2026-11-16: the Blueprint sources are not delivered to `main` (concern 4). The number is kept so that the other requirements keep theirs.
- R14. A new Claude session opened in a fresh clone of the pull request branch, with no other context and with the cl plugins and the user-level settings and memory switched off, answers these four questions correctly from the repository alone: what the project is, what to read first, the branch and commit conventions, how to run tests.
- R15. The same new session (plugins off, as in R14), asked to build a feature that has no intent, proposes to write the intent first instead of writing code. With the cl plugins on, it also proposes the intent first.
- R16. Everything that `CLAUDE.md` and `.claude/settings.json` hold on `main` before this work is still there after it: the sections "Working agreements" and "Advisor", and the keys `extraKnownMarketplaces`, `enabledPlugins`, `model` and `advisorModel` with their values. Check: `git diff main` for the two files shows added lines only.

## Design
### Layout
```
toki/
├─ CLAUDE.md                 exists on main; this work adds the sections named in R1 to R9 and keeps the rest (R16)
├─ .claude/
│  └─ settings.json          exists on main with the cl plugins enabled (R11); also holds permission rules (PR #13); this work adds nothing to it (R12)
└─ docs/
   ├─ intents/               one file per accepted intent
   ├─ specs/                 <date>-<slug>-design.md
   └─ plans/                 one plan per ticket
```
- `CLAUDE.md` is short and points to documents; it does not copy the Blueprint. The Blueprint is an external source outside the repository and is not delivered to `main`. Product and technical facts reach `CLAUDE.md` from the Blueprint once, when this work is written (R1, R3, R4, R5), and the specs and intents on `main` carry the rest.
- TOKI-095 needs no other ticket, so it can land before the code exists. Sections that describe things not built yet (layout, commands, tests) mark each item "planned" with its ticket. TOKI-095 owns the removal of the marks, through the rule in R9 written in `CLAUDE.md`; the delivering specs do not carry that line (concern 8).
- Assumption: an empty folder is kept in git with a `.gitkeep` file. `docs/intents` and `docs/specs` already hold this intent and this spec.
- Assumption: project-wide settings go in `.claude/settings.json` (committed); nothing in this work writes user-level or local settings.

## Testing
- No test code is added: the change is documents and one JSON file. The checks below are steps and commands that a person runs on the pull request branch before it is merged, and their output goes in the PR description. The check of R14 and R15 is not postponed until after the merge. By the decision in concern 10, these written checks, run on the PR branch before the merge, count as the test for this ticket.
- R16: run `git diff main -- CLAUDE.md .claude/settings.json` and confirm it shows added lines only.
- R1 to R9: open `CLAUDE.md`, confirm each section by name, and read each against its requirement. R2: confirm every fixed path in "Read first" exists on the branch and each pattern matches a file, and that no path points into a Blueprint folder. R7: search `CLAUDE.md` for the branch format; it appears once.
- R10: list `docs/intents`, `docs/specs` and `docs/plans` in a fresh clone.
- R11: `jq . .claude/settings.json` exits 0 and shows the four plugins enabled from the `cl` marketplace. Then, in a fresh clone on a machine or profile that has no cl plugin installed at user level and with access to the marketplace repository, accept the trust and install prompts and confirm the session lists the cl skills. A run on a machine where the plugins are already installed does not count.
- R12: with `jq`, confirm the 14 allow rules and 6 deny rules of `main` are present unchanged and that the file has no further permission rule and no hook (`git diff main -- .claude/settings.json` shows no change). Search the file for token-like strings and for `/Users/` or `/home/`: no match.
- R13: dropped; nothing to check.
- Fresh-session check (R14, R15): clone the pull request branch to a new folder; start a session with the cl plugins disabled and with user-level `CLAUDE.md`, settings and memory not read (a clean profile); give no context. Ask the four questions of R14 and make the request of R15; record the answers. Start a second session with the cl plugins enabled and make the request of R15 again. The first session shows that `CLAUDE.md` alone gives the answers; the second that the plugins do not contradict it. Pass: each of the four answers matches `CLAUDE.md` and the intent is proposed first in both sessions. A wrong or missing answer fails the check. One run per condition (plugins off, plugins on) is enough (concern 7).
- Definition of done: the written checks above count as "a test"; the one named exception is stated in the PR description. The CI item is waived until TOKI-007 exists (concern 10).

## Data safety
- `CLAUDE.md` and `.claude/settings.json` are committed, so they hold no secret, token, real environment value or personal data. The Blueprint rule stands: secrets live in `.env`, never in git.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| This is Blueprint intent I16 `claude-project-setup`. It has one ticket by decision: TOKI-095. | Scope: all requirements (R1 to R12, R14 to R16) fit one ticket; no second ticket is proposed. |
| Milestone: M1, Foundation and design system. Its goal includes "the project is set up for Claude". | Planning fact; no design impact. R14 and R15 are the check for that part of the M1 goal. |
| Size: M (about one working session with Claude). | Scope: documents and one settings file only; no code, lint, CI or scripts (see Out). |
| Needs: no other ticket. Needed by: no other ticket in the plan. | Design, Layout: items not built yet are marked "planned" with their ticket, so this work does not wait for TOKI-001, 003 or 008. |
| `CLAUDE.md` covers what the project is, the repository layout, common commands, the boundary rules and where documents live. | R1, R3, R4, R5, R6. |
| The cl plugins are enabled, and `docs/intents`, `docs/specs` and `docs/plans` exist. | R10, R11. The plugins are already enabled on `main` (concern 3). |
| Permissions and hooks are set in `.claude/settings.json`. | R12. The permission rules are on `main` already (PR #13); no further rule or hook, by decision (concern 2). |
| The Blueprint intent list and ticket list are drafts awaiting review. No ticket exists on GitHub yet. | Planning fact; no design impact. This spec carries `Ticket: TOKI-095`, the Blueprint code; no tracker issue exists for it yet (concern 9). |

## Open questions from the intent
- The intent lists the questions below (review of 2026-11-16: "None" was wrong). The Blueprint lists nothing open for TOKI-095; the gaps were found in the Clarify step.
  - What are the branch and commit conventions? Answered: branch `<type>/<ticket>-<slug>` and Conventional Commits with a lowercase subject, as `CLAUDE.md` on `main` states. See concern 1.
  - Which permissions and hooks go in `.claude/settings.json`? Answered: those on `main` (PR #13 settings, plus the cl-core plugin hooks) and nothing more. Decided by Thanh on 2026-11-16. See concern 2.
  - Which cl plugins are enabled? Answered: `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` from the `cl` marketplace. See concern 3.
  - What do "the Blueprint sources" consist of, and where are they now? Answered: they are not pushed to `main`; PR #12 is out of scope; R13 is dropped. Decided by Thanh on 2026-11-16. See concern 4.
  - What are the test commands? Answered from the drafted spec of TOKI-008: `pnpm test` and `pnpm test:e2e`. See concern 5.
  - Which documents are in "Read first", and in what order? Answered by R2; the order is an assumption for the lead to confirm. See concern 6.
  - How many fresh-session runs prove "unprompted"? Answered: one run per condition. Decided by Thanh on 2026-11-16. See concern 7.

## Areas of concern
1. The Blueprint requires a new session to know the branch and commit conventions but does not state them. Answered: `CLAUDE.md` on `main` states them: one ticket per branch named `<type>/<ticket>-<slug>` with the ticket id in lowercase, and Conventional Commits with a lowercase subject. Evidence: `CLAUDE.md` on `main`, section "Working agreements", added by the merged PR #11 (`/cl-core:setup`). R7 only adds one example of each. The Blueprint decision D-023 (earlier Q23) is about hosting, CI, test depth and review; it says nothing about branch names or commit messages, so it is no evidence for them. It does say "one PR per task group", which differs from "one ticket per branch". Answered: "one ticket per branch" replaces D-023's "one PR per task group"; D-023 is replaced by the `CLAUDE.md` rule on `main`. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-16. This spec follows `CLAUDE.md` on `main`. Nothing open. Owner: Thanh Truong.
2. The Blueprint says permissions and hooks are set in `.claude/settings.json` but names none. Answered: `.claude/settings.json` on `main` already holds 14 allow rules (fetch, switch, `checkout -b`, worktree, push, `gh pr` create/view/list/diff/checks/comment/review/edit, `gh issue`) and 6 deny rules (`gh pr merge`, force push, `branch -D`, remote branch deletion), added by PR #13. It holds no hook. The cl-core plugin ships its own hooks: session-start routing, `block-secrets` and `block-main` before Bash, and `block-prompt-secrets` on prompt submit. No permission rule and no hook is added beyond these (R12). Evidence: `.claude/settings.json` on `main`; `hooks/hooks.json` of the cl-core plugin 0.5.0. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-16. Nothing open. Owner: Thanh Truong.
3. The Blueprint says "the cl plugins" without a list. Answered: `.claude/settings.json` on `main` enables `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` from the `cl` marketplace (`thanhtruong-agilityio/claude-config`), chosen by the lead when running `/cl-core:setup` on 2026-11-12. Evidence: `CLAUDE.md` and `.claude/settings.json` on `main`, added by the merged PR #11 (`/cl-core:setup`). The marketplace repository is private, so R11 holds only for a person with access to it. Owner: Thanh Truong.
4. The Blueprint does not say what "the Blueprint sources" are. Answered: the Blueprint is not pushed to `main`. PR #12 is out of scope, R13 (delivering the sources) is dropped, and the Blueprint stays an external source outside the repository. R2 reads only documents that exist on `main`, and `CLAUDE.md` gives no repository path for the Blueprint. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-16. Nothing open. Owner: Thanh Truong.
5. The Blueprint names the test tools (Vitest, Playwright) but no test command. Answered from the draft spec of TOKI-008 (PR #8, not merged): `pnpm test` runs Vitest for every package with tests (its R1, and its R4 and R7 for the server tests); `pnpm test:e2e` runs the Playwright tests in `e2e/` (its R10). R8 names them and marks them TOKI-008. If PR #8 changes them, R4 and R8 change. Owner: Thanh Truong.
6. The "Read first" list and its order are not stated. Assumption for the draft, now in R2 and limited to documents that exist on `main` (decision on concern 4): the intent and spec of the work in hand, then `docs/definition-of-done.md`. Needs confirmation. Owner: Thanh Truong.
7. "Follows intent -> spec -> ticket unprompted" is behaviour of a model, so one passing run is weak proof. Answered: one run per condition (plugins off, and plugins on); see Testing. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-16. Nothing open. Owner: Thanh Truong.
8. `CLAUDE.md` will describe layout and commands that do not exist until TOKI-001, 003 and 008 land. Review of 2026-11-16: the sibling specs do not carry the work of removing the "planned" marks. Answered: TOKI-095 itself removes the marks, through the rule in R9 written in `CLAUDE.md`; the delivering specs do not carry that line, so those PRs do not change. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-16. Nothing open. Owner: Thanh Truong.
9. Review of 2026-11-16: the spec carries `Ticket: TOKI-095`, the Blueprint code, while no tracker issue exists for it. Answered: no issue with that key exists on the repository (checked on 2026-11-16 with `gh issue list`); the other tickets have issues titled "<name> (TOKI-xxx)". The line keeps the Blueprint code, as the other specs do, and points to the issue once it exists. Evidence: `docs/ticket-config.yml` on `main` (`tracker: github`); the TOKI-004 spec, concern 18. Owner: Thanh Truong.
10. `docs/definition-of-done.md` asks for a test that covers the change and a green CI. This ticket adds no test code, and CI does not exist until TOKI-007. Answered: a hand-written check counts as "a test" for docs and config tickets; the written check steps in Testing, run on the PR branch before the merge, count as the test, with one named exception stated in the PR description. The CI item is waived until TOKI-007 exists. Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-16. Nothing open. Owner: Thanh Truong.
