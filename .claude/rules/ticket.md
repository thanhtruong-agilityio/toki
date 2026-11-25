# Ticket rules

This file has no `paths:` list, so it loads in every session. Each statement is followed by its source. All of them are rules of this project.

## From a requirement to a ticket

Work reaches development through documents, not through tickets written by hand:

1. An intent, `docs/intents/<slug>.md`: problem, proposed outcome, affected users and systems, constraints, open questions.
2. A spec, `docs/specs/<date>-<slug>-design.md`. Its header carries an `Intent:` line with the path of the intent and a `Ticket:` line with the key (`TOKI-NNN`). Its body has the requirements (`R1`, `R2`, ...), the design, the testing, a table of how each constraint of the intent is met, "Open questions from the intent" and "Areas of concern".
3. Intent and spec go to `main` in one pull request on the branch `spec/<slug>`.
4. When that pull request is merged, the `Spec ticket` workflow gives each spec a GitHub issue titled `<intent title> (<KEY>)`: status `accepted` when the spec is ready, `blocked` with a comment that lists what is open when it is not.
5. Development of the ticket happens on its ticket branch, with its plan in `docs/plans/<KEY>.md`.

Source: `.github/workflows/spec-ticket.yml` and `.github/scripts/spec-ticket.sh`; the specs on `main` for the format.

- A script reads the wording of a spec to decide whether it is ready. The wording rule is in `.claude/rules/specs.md`. Check a spec with `/spec-check` before its pull request.
  Source: `.github/scripts/spec-ready.sh`.
- `docs/ticket-config.yml` maps the logical statuses (`intent`, `blocked`, `spec-review`, `accepted`, `in-dev`, `in-review`, `in-qa`, `done`) to the names on the tracker, and holds the labels and the thresholds the cl skills read. Use the logical keys; do not hard-code a tracker name.
  Source: `docs/ticket-config.yml`.

## Process

- Work goes intent -> spec -> ticket. Work with no accepted intent starts by writing one; do not start on code.
  Source: `docs/specs/2026-11-12-claude-project-setup-design.md`, R9.
- Before you start work on a ticket, read in this order: its intent, its spec, then `docs/definition-of-done.md`.
  Source: claude-project-setup spec, R2.
- The repository is built ticket by ticket. Check the tree for what exists: a folder or command named in a spec may not be built yet. For code that does not exist yet, the spec of your ticket is the source of truth; do not infer the structure from another ticket's spec.
  Source: claude-project-setup spec, Design.
- A pull request that adds a root script adds it to "Common commands" of `CLAUDE.md`. A pull request that adds another command adds it to the rule file of its area, or to "Commands" of `CLAUDE.md` when no area fits.
  Source: claude-project-setup spec, R4 and R9.

## After the merge

- A merged ticket is `in-qa`, not `done`. It is `done` only when its QA record passes `bash .github/scripts/qa-ready.sh <KEY>`: every spec requirement has a row or a reason, every row is approved, run and Pass, none is Blocked. A ticket that fails goes back to `in-dev` with the label `reopened`; the fix is a new pull request on the same ticket and the record is run again, earlier results kept with their dates. Tickets closed as `done` before this rule stay `done`; `bash .github/scripts/trace.sh` shows "no QA record" for them until their record is added.
  Source: `docs/specs/2026-11-24-ba-qa-acceptance-design.md`, R10.
- The QA record is `docs/qa/<KEY>.md` (header `Ticket:`, `Spec:`, `Version:`, `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`). A ticket whose change no user sees uses the `command` layer. The file in the repository decides; the ticket holds a copy as the comments `Test matrix` and `QA result`. Evidence holds no secret and no customer data.
  Source: the same spec, R1 to R5 and R11.
- An outcome (a Blueprint intent such as I16) is accepted in `docs/acceptance/<slug>.md` by the BA, against its Success Criteria confirmed before its tickets are tested. `bash .github/scripts/acceptance-ready.sh <slug> --ready` says whether every ticket of the outcome passes QA. A milestone has `docs/acceptance/milestone-<m>.md`, written after its outcomes. A criterion that is not accepted reopens the ticket listed against it.
  Source: the same spec, R6 to R9 and R18.
- One person may hold the roles of Dev, QA and BA; the records name the role next to each name. Nothing blocks or reopens a ticket by itself: the scripts report gaps.
  Source: the same spec, concerns 1 and 8.
- `bash .github/scripts/trace.sh` writes `docs/traceability.md` from the records. Each of the three scripts has a test next to it (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`).
  Source: the same spec, R12 to R14.

## Review on request

- The `PR review` workflow reviews a pull request with Claude. It starts when a comment on an open pull request mentions `@reviewer`, and by itself when the owner, a member or a collaborator opens a pull request or marks it ready for review. A push to an open pull request does not start a review.
  Source: `.github/workflows/pr-review.yml`.
- The review posts inline comments and one summary comment. It never approves or merges.
  Source: `.github/workflows/pr-review.yml`.
- The run treats the pull request as untrusted. The rules for changing the workflow are in `.claude/rules/workflows.md`.
  Source: `.github/workflows/pr-review.yml`.
