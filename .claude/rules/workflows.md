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
- Every CI job always starts and reports, so the checks stay required on `main`. A job skips its steps and passes when `.github/scripts/changed.sh` finds no file it depends on in the pull request (documents only: no end-to-end, test, type check, build, size or i18n run); `lint` always runs because `pnpm format:check` reads the documents; a push to `main` runs everything. Change the file lists in that script and in `changed.test.sh` together. Do not use `paths` or `paths-ignore` on the workflow: a check that never reports blocks the merge.
  Source: `.github/workflows/ci.yml`; `.github/scripts/changed.sh`.
- The `end-to-end` job uploads `test-results/` as the artifact `playwright-results` after every run, passed or failed. Each Playwright config has its own `outputDir` under `test-results/`, because a run empties its output folder.
  Source: `.github/workflows/ci.yml`; `playwright.config.ts`.
- Use the logical status keys of `docs/ticket-config.yml`; never hard-code a tracker name in a workflow or script.
  Source: `.claude/rules/ticket.md`.

## Commands

Run from the repository root.

```bash
# Test the readiness rule (the Spec ticket workflow runs this before it touches a ticket)
bash .github/scripts/spec-ready.test.sh

# Print what the Spec ticket workflow would write for one spec, without writing it.
# It reads the issues first: needs jq, network access and an authenticated gh.
# It prints "left alone" and no DRY-RUN line when the ticket needs no change.
DRY_RUN=1 bash .github/scripts/spec-ticket.sh docs/specs/<file>.md

# Test the rule that decides whether a CI check runs, from the files of a pull request
bash .github/scripts/changed.test.sh

# Ask for one check: prints run=true or run=false. BASE_SHA is the base commit; without it, run=true.
BASE_SHA=$(git merge-base origin/main HEAD) bash .github/scripts/changed.sh e2e

# Test the rule that reads a review request from a comment
bash .github/scripts/review-request.test.sh

# Read one comment: exit 0 when it mentions @reviewer, exit 1 when it does not ask for a review
printf '%s' '@reviewer' | bash .github/scripts/review-request.sh
```

## External standard

- Pass untrusted input (a comment body, a pull request title) to a script through an intermediate environment variable, not inline with `${{ }}` inside `run:`.
  Source: [GitHub Docs, Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use).
