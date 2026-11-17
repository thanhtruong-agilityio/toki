---
paths:
  - "docs/specs/**"
  - "docs/intents/**"
---

# Spec and intent rules

Each statement is followed by its source. All of them are rules of this project.

- A requirement becomes an intent, `docs/intents/<slug>.md`, then a spec, `docs/specs/<date>-<slug>-design.md`; both go to `main` in one pull request on `spec/<slug>`.
  Source: `CLAUDE.md`, "From a requirement to a ticket".
- The spec header has an `Intent:` line with the path of the intent (the file must exist) and a `Ticket:` line with the key (`TOKI-NNN`); the body has a Requirements section (`R1`, `R2`, ...).
  Source: `CLAUDE.md`, "From a requirement to a ticket".
- A spec is ready when every numbered item of "Areas of concern" carries "Decided", "Answered", "Accepted" or "Settled" after its last open marker, and every "Not answered" line of "Open questions from the intent" refers to an existing "concern N". A spec that is not ready gets the `blocked` status.
  Source: `CLAUDE.md`, "From a requirement to a ticket".
- The exact rule is the script, not this file. Check a spec with `/spec-check` or `bash .github/scripts/spec-ready.sh <spec>` before the pull request.
  Source: `.github/scripts/spec-ready.sh` and its test `.github/scripts/spec-ready.test.sh`.
- Use the logical statuses of `docs/ticket-config.yml` (`intent`, `blocked`, `spec-review`, `accepted`, `in-dev`, `in-review`, `in-qa`, `done`); do not write a tracker status name.
  Source: `CLAUDE.md`, "From a requirement to a ticket".
