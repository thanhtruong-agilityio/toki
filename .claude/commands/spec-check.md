---
description: Check that a spec is ready for a ticket, before opening its pull request
argument-hint: "[docs/specs/<file>.md]"
allowed-tools: Bash(bash .github/scripts/spec-ready.sh:*), Bash(git diff:*), Bash(git rev-parse:*)
---

Check a spec with the readiness rule of `.github/scripts/spec-ready.sh`. This command writes nothing.

Spec given: `$ARGUMENTS`

1. If a path was given, run `bash .github/scripts/spec-ready.sh <path>` from the repository root.
2. If no path was given, list the specs changed on this branch against `main`. Use the remote
   `main` when it exists (`github/main`, else `origin/main`, checked with `git rev-parse --verify -q`),
   because the local `main` may be behind; otherwise use `main`. List them with
   `git diff --name-only --diff-filter=AM <main>...HEAD -- 'docs/specs/*.md'`
   and run the script on each one. If the list is empty, say that no spec changed on this branch and stop.
3. Report for each spec:
   - exit 0: the spec is ready;
   - exit 1: the spec has gaps; list each `- ` line the script prints, as it prints it;
   - exit 2: the command was used wrongly; say what the script printed.

Do not edit the spec, and do not copy the rule into your answer: the script holds the exact rule.
