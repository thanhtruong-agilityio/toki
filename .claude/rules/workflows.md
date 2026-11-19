---
paths:
  - ".github/workflows/**"
  - ".github/scripts/**"
---

# Workflow rules

Each statement is followed by its source. Rules of this project come first; rules of the tool are kept apart in "External standard".

## This project

- The `PR review` workflow treats the pull request as untrusted: the workspace is `main`, the head of the pull request is only read under `pr-head/`, and Claude has read and comment tools only. Never add a tool that runs code.
  Source: `.github/workflows/pr-review.yml`.
- Never put text from a comment or a pull request into a `run:` script except through `env:`.
  Source: `.github/workflows/pr-review.yml`.
- An `issue_comment` or `pull_request_target` workflow runs the version on `main`, not the one on the pull request, so a change to `pr-review.yml` takes effect only after it is merged; the review needs the repository secret `CLAUDE_CODE_OAUTH_TOKEN`.
  Source: `.github/workflows/pr-review.yml`.
- The review starts on a comment that mentions `@reviewer` on an open pull request, and with no comment when the owner, a member or a collaborator opens a pull request or marks it ready for review. A draft, a bot's pull request and a pull request from anyone else wait for a `@reviewer` comment. A push does not start a review.
  Source: `.github/workflows/pr-review.yml`; `.github/scripts/review-request.sh`.
- The review instructions are the `prompt` of the last step of the workflow. The summary comment ends with a `<!-- review:{"sha":...} -->` marker.
  Source: `.github/workflows/pr-review.yml`.
- The `Spec ticket` workflow can be run by hand on GitHub, for one spec or for all, with a `dry_run` input.
  Source: `.github/workflows/spec-ticket.yml`.
- Spec readiness is decided by `.github/scripts/spec-ready.sh` with no network call and no model; change the rule there and in its test file together.
  Source: `.github/scripts/spec-ready.sh`; `.github/workflows/spec-ticket.yml`.
- Use the logical status keys of `docs/ticket-config.yml`; never hard-code a tracker name in a workflow or script.
  Source: `CLAUDE.md`, "From a requirement to a ticket".

## Commands

Run from the repository root.

```bash
# Test the readiness rule (the Spec ticket workflow runs this before it touches a ticket)
bash .github/scripts/spec-ready.test.sh

# Print what the Spec ticket workflow would write for one spec, without writing it.
# It reads the issues first: needs jq, network access and an authenticated gh.
# It prints "left alone" and no DRY-RUN line when the ticket needs no change.
DRY_RUN=1 bash .github/scripts/spec-ticket.sh docs/specs/<file>.md

# Test the rule that reads a review request from a comment
bash .github/scripts/review-request.test.sh

# Read one comment: exit 0 when it mentions @reviewer, exit 1 when it does not ask for a review
printf '%s' '@reviewer' | bash .github/scripts/review-request.sh
```

## External standard

- Pass untrusted input (a comment body, a pull request title) to a script through an intermediate environment variable, not inline with `${{ }}` inside `run:`.
  Source: [GitHub Docs, Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use).
