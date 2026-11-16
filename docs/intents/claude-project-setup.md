# Intent: Set up Claude for the project
Author: Thanh Truong

## Problem
Toki is built by one person working with Claude. The repository is only partly set up for Claude. `main` has `CLAUDE.md` with the working agreements and the advisor rule, `.claude/settings.json` with the cl plugins, a model, an advisor model and permission rules, the PR template, `docs/definition-of-done.md` and `docs/ticket-config.yml` (PR #11, #13, #14). It has no description of the project, layout, commands, boundary rules or document locations, no `docs/plans`, and no Blueprint sources. Until the rest is set up, the project context and the agreed process have to be explained again in each Claude session.
Source: Toki Blueprint, intent I16 (Want) and Status; the state of `main` on 2026-11-16.

## Proposed outcome
The repository is set up so Claude works to the agreed process from the first session, without the context being explained again each time.
A new Claude session that opens the repository knows:
- what the project is,
- what to read first,
- the branch and commit conventions,
- how to run tests.

It also follows intent -> spec -> ticket unprompted.
Source: Toki Blueprint, intent I16 (Want, Done).

## Affected users and systems
- Users: the builder (Thanh and Claude). Source: Toki Blueprint, intent I16 (Who).
- Systems: the Toki repository (github.com/thanhtruong-agilityio/toki) and the Claude sessions opened in it.

## Constraints
- This is Blueprint intent I16 `claude-project-setup`. It has one ticket by decision: TOKI-095. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Its goal includes "the project is set up for Claude". Source: Toki Blueprint, milestone M1.
- Size: M (about one working session with Claude). Source: Toki Blueprint, ticket TOKI-095.
- Needs: no other ticket. Needed by: no other ticket in the plan, although the TOKI-096 spec leaves the place of its documents to this work (spec R6). Source: Toki Blueprint, ticket table, Needs column.
- Scope fixed in the Blueprint (Source: Toki Blueprint, ticket TOKI-095):
  - `CLAUDE.md` covers what the project is, the repository layout, common commands, the boundary rules and where documents live.
  - The cl plugins are enabled, and `docs/intents`, `docs/specs` and `docs/plans` exist.
  - Permissions and hooks are set in `.claude/settings.json`.
  - The Blueprint sources are moved into `docs/blueprint/`.
- The Blueprint intent list and ticket list are drafts awaiting review. No GitHub issue exists for TOKI-095 yet (checked 2026-11-16). Source: Toki Blueprint, Status; `gh issue list`.

## Open questions
The Blueprint lists nothing open for TOKI-095. The spec found these gaps; the intent does not answer them (details in the spec, Areas of concern):
- Which permission rules and hooks beyond those already on `main` are wanted. Blocks R12. Owner: BA.
- Whether the Blueprint sources are delivered by PR #12 and whether `docs/blueprint-v2/` stays a second folder. Blocks R13. Owner: BA.
- Whether "one ticket per branch" replaces the decision "one PR per task group". Owner: BA.
- How many fresh-session runs prove "unprompted". Owner: BA.
- Whether the definition-of-done items "a test" and "CI is green" apply to this ticket. Owner: BA.
