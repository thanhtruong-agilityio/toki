# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Working agreements

- One ticket per branch, named `<type>/<ticket>-<slug>` (ticket id in lowercase). Never commit or push to `main`, `master`, `develop` or `release/*`.
- Commits follow Conventional Commits with a lowercase subject. PRs follow `.github/pull_request_template.md`.
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
# Test the readiness rule (the workflow runs this before it touches a ticket)
bash .github/scripts/spec-ready.test.sh

# Check one spec: exit 0 ready, exit 1 gaps (one "- " line each), exit 2 wrong usage
bash .github/scripts/spec-ready.sh docs/specs/<file>.md

# Print what the workflow would write for one spec, without writing it.
# It reads the issues first: needs jq, network access and an authenticated gh.
# It prints "left alone" and no DRY-RUN line when the ticket needs no change.
DRY_RUN=1 bash .github/scripts/spec-ticket.sh docs/specs/<file>.md
```

The workflow can also be run by hand on GitHub, for one spec or for all, with a `dry_run` input.

## Claude configuration

`.claude/settings.json` enables the `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` plugins from the `cl` marketplace, and sets the advisor model. It denies `gh pr merge`, force-push, `git branch -D` and the deletion of a remote branch; do not work around a denied command.

A `Stop` hook runs `.claude/hooks/notify-stop.sh`, which shows a desktop notification when Claude finishes a turn (`osascript` on macOS, `notify-send` on Linux, nothing elsewhere). It runs in the background and always exits 0.
