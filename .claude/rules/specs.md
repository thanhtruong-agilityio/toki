---
paths:
  - "docs/specs/**"
  - "docs/intents/**"
---

# Spec and intent rules

Each statement is followed by its source. All of them are rules of this project.

- A requirement becomes an intent, `docs/intents/<slug>.md`, then a spec, `docs/specs/<date>-<slug>-design.md`; both go to `main` in one pull request on `spec/<slug>`.
  Source: `.claude/rules/ticket.md`.
- The spec header has an `Intent:` line with the path of the intent (the file must exist) and a `Ticket:` line with the key (`TOKI-NNN`); the body has a Requirements section (`R1`, `R2`, ...).
  Source: `.claude/rules/ticket.md`.
- A spec is ready when it has all of the following. A spec that is not ready gets the `blocked` status and a comment that lists what is open.
  - A `Ticket:` line, an `Intent:` line whose file exists, and a Requirements section.
  - In every numbered item of "Areas of concern", one of "Decided", "Answered", "Accepted" or "Settled" (capitalised; "Answered in part" does not count), placed after the item's last open marker ("Not decided", "Not answered", "not a decision", "Still open", in any case). An item with no open marker still needs the decision word.
  - For every line of "Open questions from the intent" that says "Not answered", a reference to an existing "concern N".
  Source: `.github/scripts/spec-ready.sh`.
- A spec with no `Ticket:` line or no intent file gets no ticket; the gaps go into a comment on the pull request. An issue that is closed, or already in development or later, is left alone.
  Source: `.github/workflows/spec-ticket.yml` and `.github/scripts/spec-ticket.sh`.
- The exact rule is the script, not this file. Check a spec with `/spec-check` or `bash .github/scripts/spec-ready.sh <spec>` before the pull request.
  Source: `.github/scripts/spec-ready.sh` and its test `.github/scripts/spec-ready.test.sh`.
- Use the logical statuses of `docs/ticket-config.yml` (`intent`, `blocked`, `spec-review`, `accepted`, `in-dev`, `in-review`, `in-qa`, `done`); do not write a tracker status name.
  Source: `.claude/rules/ticket.md`.
