# Intent: Rules, hooks and a spec check for Claude in the project
Author: Thanh Truong

## Problem
Toki is built by one person working with Claude. `CLAUDE.md` now describes the project and its process (TOKI-095, PR #94), but the things Claude must never do are spread over several sections, the area-specific conventions (server, web, packages, specs, workflows) are not written down where Claude meets those files, and nothing in the repository stops a mistake before it happens. `.claude/settings.json` has permission rules and one notification hook. A session can still push from a branch with no slug, hand-edit the lock file, or write a spec that the readiness script then rejects, and it finds out only later.
Source: the TOKI-095 spec (R12 and "Out" scope) and `main` on 2026-11-17.

## Proposed outcome
Claude follows the project's rules without being reminded, and the repository blocks the most common mistakes itself:
- `CLAUDE.md` has one short list of what Claude must never do, collected from rules that already exist in the repository.
- Conventions for each area of the code and the documents are written once, and a session sees them when it works on a file of that area.
- The mistakes named above are stopped by a hook, not by memory.
- A project command lets a session check a spec before it opens a pull request.

This replaces the TOKI-095 decision that `.claude/settings.json` gets no hook (its spec, R12 and concern 2).

## Affected users and systems
- Users: the builder (Thanh and Claude).
- Systems: `CLAUDE.md`, `.claude/` (settings, rules, hooks, commands) and the Claude sessions opened in the repository.

## Constraints
- Every item in the "never do" list and in the area conventions has a source: a rule already in `CLAUDE.md`, the lint configuration, a merged spec or a workflow, or the official documentation of the tool, with a link. A rule of the tool is kept apart from a rule of the project.
- A hook must not duplicate one that the cl-core plugin already ships (`block-secrets`, `block-main`, `block-prompt-secrets`).
- No command is added for code that does not exist yet. Rule files for the server and the web are written now, from the merged specs and the official standards.
- The change adds to `CLAUDE.md` and `.claude/settings.json` and removes nothing from them.
- The two permission lists on `main` (14 allow, 6 deny) stay as they are.
- The "never delete a branch without asking" rule is not part of the list; the existing "Ask before every branch deletion and deploy" line stays where it is.
- No secret, token or personal path in any committed file.

## Open questions
- Which hooks exactly. Answered: branch slug, lock file and format. Decided by Thanh on 2026-11-17.
- Which area rules to write now. Answered: server, web, packages, typescript, specs and workflows, with the official standards added. Decided by Thanh on 2026-11-17.
- Which project command to ship now. Answered: the spec check; the module command stays out. Decided by Thanh on 2026-11-17.
- The ticket key. Answered: TOKI-105 (next free key). Open: none.
