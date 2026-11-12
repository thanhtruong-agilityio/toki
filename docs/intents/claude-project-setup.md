# Intent: Set up Claude for the project
Author: Thanh Truong

## Problem
Toki is built by one person working with Claude. The repository is not yet set up for Claude: nothing has been committed, and no intent or spec has been written. Until it is set up, the project context and the agreed process have to be explained again in each Claude session.
Source: Toki Blueprint, intent I16 (Want) and Status.

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
- Needs: no other ticket. Needed by: no other ticket in the plan. Source: Toki Blueprint, ticket table, Needs column.
- Scope fixed in the Blueprint (Source: Toki Blueprint, ticket TOKI-095):
  - `CLAUDE.md` covers what the project is, the repository layout, common commands, the boundary rules and where documents live.
  - The cl plugins are enabled, and `docs/intents`, `docs/specs` and `docs/plans` exist.
  - Permissions and hooks are set in `.claude/settings.json`.
  - The Blueprint sources are moved into `docs/blueprint/`.
- The Blueprint intent list and ticket list are drafts awaiting review. No ticket exists on GitHub yet. Source: Toki Blueprint, Status.

## Open questions
None. The Blueprint lists nothing open for the spec on TOKI-095.
