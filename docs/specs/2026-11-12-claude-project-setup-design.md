# Claude project setup design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/claude-project-setup.md (Thanh Truong)
Ticket: TOKI-095

## Goal
Toki is built by one person working with Claude. Today the project context and the agreed process must be explained again in each Claude session. This work sets up the repository so a new session knows what the project is, what to read first, the branch and commit conventions and how to run tests, and follows intent -> spec -> ticket without being told.

## Scope
- In: a root `CLAUDE.md`; the folders `docs/intents`, `docs/specs`, `docs/plans`, `docs/blueprint`; a project `.claude/settings.json` that enables the cl plugins and holds permissions and hooks; moving the Blueprint sources into `docs/blueprint/`.
- Out (not now):
  - Creating the monorepo, apps and packages: TOKI-001.
  - ESLint, Prettier and lint enforcement of the boundary rules: TOKI-002. This spec only writes the rules down.
  - Docker Compose and the `dev:*` scripts: TOKI-003.
  - CI on GitHub Actions: TOKI-007.
  - The test harness and the test commands themselves: TOKI-008.
  - The environment variable inventory, `.env.example` and how secrets are kept: TOKI-096.
  - The `dev:seed` script: TOKI-081. The installation guide: TOKI-087.
  - Personal settings (`.claude/settings.local.json`, user-level settings) and any change to the cl plugins themselves.
  - Creating the GitHub ticket for TOKI-095. The intent does not ask for it.

## Requirements
- R1. `CLAUDE.md` exists at the repository root and has a section "What the project is" that states, from the Blueprint: internal team chat for one company, single-tenant and self-hosted, built in phases, phase 1 is core chat on the web, and the prototype is the only design source.
- R2. `CLAUDE.md` has a section "Read first" that lists, in order, the documents a new session must read. Every path in the list exists in the repository.
- R3. `CLAUDE.md` has a section "Repository layout" that shows the phase 1 tree from the Blueprint (`apps/server`, `apps/web`, the six packages, `infra`, `e2e`, `docs`). Each folder that does not exist yet is marked with the ticket that creates it.
- R4. `CLAUDE.md` has a section "Common commands". Each command is one that the Blueprint names. Each command that does not work yet is marked with the ticket that delivers it.
- R5. `CLAUDE.md` has a section "Boundary rules" that states the three rules in the wording of the newer Blueprint version, and says that file picking is checked by review, not lint.
- R6. `CLAUDE.md` has a section "Where documents live" that names `docs/intents`, `docs/specs`, `docs/plans` and `docs/blueprint`, with one line on what each holds.
- R7. `CLAUDE.md` has a section "Branch and commit conventions" that states the branch name format and the commit message format, each with one example.
- R8. `CLAUDE.md` has a section "Running tests" that says which command runs which kind of test (unit, server integration, end-to-end), or names the ticket that delivers the command when it does not exist yet.
- R9. `CLAUDE.md` has a section "Process" that states the order intent -> spec -> ticket and says that work without an accepted intent starts by writing one.
- R10. The folders `docs/intents`, `docs/specs` and `docs/plans` exist in a fresh clone of the repository.
- R11. `.claude/settings.json` is committed, is valid JSON and enables the cl plugins, so a session opened in a fresh clone lists the cl skills without any manual install step.
- R12. `.claude/settings.json` holds a permissions block and a hooks block. The file contains no secret, token or personal path.
- R13. The Blueprint sources are in `docs/blueprint/` and in no other place in the repository. "Read first" (R2) points to that folder.
- R14. A new Claude session opened in a fresh clone, with no other context, answers these four questions correctly from the repository alone: what the project is, what to read first, the branch and commit conventions, how to run tests.
- R15. The same new session, asked to build a feature that has no intent, proposes to write the intent first instead of writing code.

## Design
### Layout
```
toki/
├─ CLAUDE.md                 sections named in R1 to R9
├─ .claude/
│  └─ settings.json          cl plugins enabled, permissions, hooks (R11, R12)
└─ docs/
   ├─ blueprint/             the Blueprint sources, moved here (R13)
   ├─ intents/               one file per accepted intent
   ├─ specs/                 <date>-<slug>-design.md
   └─ plans/                 one plan per ticket
```
- `CLAUDE.md` is short and points to documents; it does not copy the Blueprint. The Blueprint in `docs/blueprint/` stays the source for product and technical facts.
- TOKI-095 needs no other ticket, so it can land before the code exists. Assumption: sections that describe things not built yet (layout, commands, tests) mark each item "planned" with its ticket, and the ticket that delivers the item removes the mark.
- Assumption: an empty folder is kept in git with a `.gitkeep` file. `docs/intents` and `docs/specs` already hold this intent and this spec.
- Assumption: project-wide settings go in `.claude/settings.json` (committed); nothing in this work writes user-level or local settings.

## Testing
- No automated test. The check is a manual review, done once after the setup is merged.
- File check: open `CLAUDE.md` and confirm the nine sections of R1 to R9 by name; confirm every path in "Read first" exists; validate `.claude/settings.json` as JSON; list the four `docs/` folders in a fresh clone.
- Fresh-session check: open a new Claude session in a fresh clone, give no context, ask the four questions of R14 and make the request of R15. Record the answers in the PR description. A wrong or missing answer fails the check.

## Data safety
- `CLAUDE.md` and `.claude/settings.json` are committed, so they hold no secret, token, real environment value or personal data. The Blueprint rule stands: secrets live in `.env`, never in git.
- The Blueprint sources are checked for secrets and personal data before they are moved into `docs/blueprint/`.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| This is Blueprint intent I16 `claude-project-setup`. It has one ticket by decision: TOKI-095. | Scope: all requirements R1 to R15 fit one ticket; no second ticket is proposed. |
| Milestone: M1, Foundation and design system. Its goal includes "the project is set up for Claude". | Planning fact; no design impact. R14 and R15 are the check for that part of the M1 goal. |
| Size: M (about one working session with Claude). | Scope: documents and one settings file only; no code, lint, CI or scripts (see Out). At risk while concerns 1 to 4 are open. |
| Needs: no other ticket. Needed by: no other ticket in the plan. | Design, Layout: items not built yet are marked "planned" with their ticket, so this work does not wait for TOKI-001, 003 or 008. |
| `CLAUDE.md` covers what the project is, the repository layout, common commands, the boundary rules and where documents live. | R1, R3, R4, R5, R6. |
| The cl plugins are enabled, and `docs/intents`, `docs/specs` and `docs/plans` exist. | R10, R11. Which plugins: concern 3. |
| Permissions and hooks are set in `.claude/settings.json`. | R12. Which permissions and hooks: concern 2. |
| The Blueprint sources are moved into `docs/blueprint/`. | R13. What the sources are: concern 4. |
| The Blueprint intent list and ticket list are drafts awaiting review. No ticket exists on GitHub yet. | Planning fact; no design impact. This spec has no `Ticket:` line until the ticket exists. |

## Open questions from the intent
- The intent lists none ("None. The Blueprint lists nothing open for the spec on TOKI-095."). Nothing to answer.
- Gaps found in the Clarify step, which the intent and the Blueprint do not answer:
  - What are the branch and commit conventions? Answered in part. Carried forward as concern 1.
  - Which permissions and hooks go in `.claude/settings.json`? Not answered. Carried forward as concern 2.
  - Which cl plugins are enabled? Not answered. Carried forward as concern 3.
  - What do "the Blueprint sources" consist of, and where are they now? Not answered. Carried forward as concern 4.
  - What are the test commands? Not answered. Carried forward as concern 5.
  - Which documents are in "Read first", and in what order? Not answered. Carried forward as concern 6.
  - How many fresh-session runs prove "unprompted"? Not answered. Carried forward as concern 7.

## Areas of concern
1. The Blueprint requires a new session to know the branch and commit conventions but does not state them. R7 cannot be written until they are given (for example, whether the cl shared conventions apply as they are). Answered in part: the workflow decision Q23 is "Private GitHub, CI, test-first backend, Playwright, one PR per task group". Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Questions & Gaps tab, decision Q23. Still open: the branch naming and commit message conventions themselves, which the Blueprint does not state. Owner: Thanh Truong.
2. The Blueprint says permissions and hooks are set in `.claude/settings.json` but names none. The allow, ask and deny rules and each hook (event and purpose) must be decided before R12 can be built; a wrong guess either blocks normal work or allows too much. Owner: Thanh Truong.
3. The Blueprint says "the cl plugins" without a list. It must be decided which ones (for example cl-core, cl-dev, cl-lead, cl-ba-qa) and from which marketplace, so that R11 works in a fresh clone. Owner: Thanh Truong.
4. The Blueprint does not say what "the Blueprint sources" are (which files, which formats, whether the prototype is included) or where they are today. R13 needs that list, and a check that the files hold no secret or personal data. Owner: Thanh Truong.
5. The Blueprint names the test tools (Vitest, Playwright) but no test command, and the harness comes later in TOKI-008. Until then R8 can only name the ticket, so a new session cannot yet run tests; R14 passes on "how to run tests" only in that limited sense. Owner: Thanh Truong.
6. The "Read first" list and its order are not stated. Assumption for the draft: `CLAUDE.md`, then `docs/blueprint/`, then the intent and spec of the work in hand. Needs confirmation. Owner: Thanh Truong.
7. "Follows intent -> spec -> ticket unprompted" is behaviour of a model, so one passing run (R15) is weak proof. It must be decided how many runs and which prompts count as passing. Owner: Thanh Truong.
8. `CLAUDE.md` will describe layout and commands that do not exist until TOKI-001, 003 and 008 land. If those tickets do not update the "planned" marks, the file goes stale and misleads new sessions. Owner: Thanh Truong.
