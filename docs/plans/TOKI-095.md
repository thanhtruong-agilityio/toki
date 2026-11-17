# TOKI-095 Set up Claude for the project - implementation plan

**Goal:** a new Claude session learns from `CLAUDE.md` alone what Toki is, what to read first, the repository layout, the commands, the boundary rules, where documents live, how to run tests and the intent -> spec -> ticket process.

**Spec:** `docs/specs/2026-11-12-claude-project-setup-design.md` (R1 to R16). Tier M.

## Design

- Documents only. One file changes: `CLAUDE.md`. `.claude/settings.json` is not touched (R12). `docs/plans/` already exists on `main` (R10).
- Work on a new branch from `main`. The branch `ci/toki-095-pr-review-on-comment` is already merged (PR #58).
- `CLAUDE.md` changes are additive only (R16): no existing line is removed or reworded. The branch and commit examples (R7) are new sub-bullets under the existing rules, so the rules are not written twice.
- New sections, by requirement: R1 "What the project is", R2 "Read first", R3 "Repository layout" (before "Working agreements"); R4 "Common commands", R8 "Running tests", R5 "Boundary rules", R6 "Where documents live", R9 "Process" (before "Review on request").
- Wording of R1, R3 and R5 comes once from the Blueprint, an external source. `CLAUDE.md` gives no repository path for it (concern 4).
- "Common commands" lists only root scripts that exist on `main`, plus `test` and `test:e2e` marked planned (TOKI-008). It overlaps the existing "Commands" section on purpose: renaming or merging would remove lines (R16).

### Facts that differ from the spec text (checked against `main` on 2026-11-17)

- `pnpm lint:boundaries` is not listed. TOKI-002 dropped it (its spec, concern 13); `pnpm lint` runs the three boundary rules.
- `infra/` does not exist. TOKI-003 put the development compose file at the root as `docker-compose.dev.yml`, so the layout says so instead of naming a ticket.
- The three boundary rules are enforced by `eslint.config.js` and `tools/lint-rules/`; rule 1 of the spec (server modules) is the `module-entry` rule.

## Checks

Run on the branch before the merge; output goes in the pull request (spec concern 10).

| Req | Check |
| :---- | :---- |
| R16 | `git diff main -- CLAUDE.md .claude/settings.json` shows added lines only |
| R1 to R9 | each section exists by name and reads against its requirement |
| R2 | every path and pattern in "Read first" exists / matches; no Blueprint path |
| R7 | the branch format rule appears once |
| R12 | `.claude/settings.json` unchanged; no `/Users/` or `/home/` in the files |
| R14, R15 | fresh sessions, plugins off and on (run by hand) |
