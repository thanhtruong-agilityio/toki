---
paths:
  - ".github/workflows/**"
  - ".github/scripts/**"
---

# Workflow rules

Each statement is followed by its source. Rules of this project come first; rules of the tool are kept apart in "External standard".

## This project

- The `PR review` workflow treats the pull request as untrusted: the workspace is `main`, the head of the pull request is only read under `pr-head/`, and Claude has read and comment tools only. Never add a tool that runs code.
  Source: `CLAUDE.md`, "Review on request".
- Never put text from a comment or a pull request into a `run:` script except through `env:`.
  Source: `CLAUDE.md`, "Review on request".
- An `issue_comment` workflow runs the version on `main`, not the one on the pull request; the review needs the repository secret `CLAUDE_CODE_OAUTH_TOKEN`.
  Source: `CLAUDE.md`, "Review on request".
- Spec readiness is decided by `.github/scripts/spec-ready.sh` with no network call and no model; change the rule there and in its test file together.
  Source: `CLAUDE.md`, "From a requirement to a ticket"; `.github/workflows/spec-ticket.yml`.
- Use the logical status keys of `docs/ticket-config.yml`; never hard-code a tracker name in a workflow or script.
  Source: `CLAUDE.md`, "From a requirement to a ticket".

## External standard

- Pass untrusted input (a comment body, a pull request title) to a script through an intermediate environment variable, not inline with `${{ }}` inside `run:`.
  Source: [GitHub Docs, Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use).
