# TOKI-105: Rules, hooks and a spec check for Claude in the project

Ticket: TOKI-105 (issue 97) · Tier: M · Branch: `chore/toki-105-claude-rules-and-hooks`
Spec: `docs/specs/2026-11-17-claude-rules-and-hooks-design.md` · Intent: `docs/intents/claude-rules-and-hooks.md`

## Design

The accepted spec is the design (layout, hook shape, assumptions). This plan adds no design of its own. Decisions taken while planning:

- The branch-slug hook is the script of commit `503ed94`, copied as it is (it reads the JSON with `jq` and ends with exit 0 when `jq` is missing).
- Hooks decide on the file path or the command in the JSON on standard input. The lock-file hook compares the base name with `pnpm-lock.yaml`.
- The format hook calls `pnpm exec prettier --write <file>` from `$CLAUDE_PROJECT_DIR`. Prettier skips a file listed in `.prettierignore` by itself when the file is named on the command line, so `.claude/`, `docs/` and `.github/` are untouched. The extension list of R9 is checked in the script. Every failure path ends with exit 0.
- No hook writes to a file or to standard output; messages go to standard error (spec, Data safety).
- Build order: tests first for the hooks, then the hooks, then the command, then the rule files, then `CLAUDE.md`.

## AC → step → test

| Req | Step | Test |
| :-- | :-- | :-- |
| R7 | 1. `check-branch-slug.sh` from `503ed94`; `PreToolUse` on `Bash` | `hooks.test.sh`: `git push` and `gh pr create` on `feat/toki-002` exit 2 with the rename text; on `docs/toki-095-claude-md-sections` exit 0; `git status` exit 0 |
| R8 | 1. `block-lockfile-edit.sh`; `PreToolUse` on `Edit` and `Write` | `hooks.test.sh`: `Edit` of `pnpm-lock.yaml` exit 2 (also a nested path); `package.json` exit 0; `Write` the same |
| R9 | 1. `format-after-edit.sh`; `PostToolUse` on `Edit` and `Write` | `hooks.test.sh`: a badly formatted `.ts` file is formatted; a `.md` file and a `.prettierignore` file are unchanged; Prettier missing from the path gives exit 0 |
| R10 | 1. All three read JSON on standard input, use `$CLAUDE_PROJECT_DIR` | `hooks.test.sh`: a search of the three scripts for `/Users/` and `/home/` finds nothing |
| R12 | 1. Add the three entries only | `git diff main -- .claude/settings.json` shows added lines only; 14 allow and 6 deny counted |
| R11 | 2. `.claude/commands/spec-check.md` | Run on the TOKI-105 spec (ready), and on a copy with a concern left open (gap listed); with no argument it lists the specs changed against `main` |
| R3 | 3. Six files in `.claude/rules/`, each with `paths:` and at most 60 lines | `wc -l`; the front matter of each file read; loading checked in a fresh session on a file under `apps/server/` |
| R4, R5 | 3. Each statement followed by one source line; kind (b) in a section `External standard` with a link | A list in the pull request, one line per statement with its source; every link opened (HTTP 200) and the statement found on the page |
| R6 | 3. `specs.md` states the readiness rule and points to `spec-ready.sh` | Read against `CLAUDE.md` and the script; no copy of the script |
| R1, R2 | 4. `## Never do` after "Working agreements", eight lines, each with its source | Read: eight lines, each names a source that exists; no branch-deletion line |
| R13 | 4. One line in "Claude configuration" (hooks, rules, command); one line in Commands for `hooks.test.sh` | `git diff main -- CLAUDE.md` shows added lines only; the branch format rule appears once |
| R14 | all | `grep -rE '/Users/\|/home/'` on the changed files finds nothing |

## Steps

1. Hooks. Write `.claude/hooks/hooks.test.sh` first and run it: every case must fail because the scripts do not exist. Then write the three scripts, register them in `.claude/settings.json`, run the tests until green.
2. Command `/spec-check`.
3. Rule files, one at a time. For each statement, open the cited spec, lint rule or page before writing it.
4. `CLAUDE.md`: the section `## Never do`, the line in "Claude configuration", the line in Commands.
5. Check: tests, the R12 to R14 diffs, the link check; verifier; `/code-review`.

## What can break (one grilling round)

- Riskiest step: the format hook. It runs on every edit, so a wrong match rewrites a file the user did not mean. Guard: the extension list and `.prettierignore` are tested; a Prettier failure never fails the tool call (R9).
- The slug hook matches the text `git push` anywhere in a command, so `echo "git push"` on a slug-less branch is refused. Accepted: the message tells how to rename, and the case is rare.
- The slug hook and `jq`: with no `jq` the hook lets everything through. Accepted: same as the script of `503ed94`; the `PreToolUse` guard in the cl-dev plugin is a second barrier.
- External links may move. The link check runs at build time; the pull request records the date.
- A rule file with a statement that has no source breaks R4. Guard: the list in the pull request is written from the files, line by line.
- Rule loading by `paths:` is an assumption of the spec; if the test shows a file does not load, the front matter is fixed before the pull request.
