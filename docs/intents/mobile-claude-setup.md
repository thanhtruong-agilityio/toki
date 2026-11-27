# Intent: Set up Claude for the mobile app

Author: Huy Nguyen

## Problem

The repository tells a Claude session what it must know through `CLAUDE.md` and the area rule files in `.claude/rules/` (server, web, packages, typescript, specs, workflows, tooling). Each rule file loads when a session works on a file of its area. None of this covers the phone app:

- `CLAUDE.md` does not list `packages/ui-native`, and its "Repository layout" and "Boundary rules" sections describe the web app only.
- No rule file loads for `apps/mobile` or `packages/ui-native`. A session that works there does not see the mobile decisions: the development build rather than Expo Go, native folders generated rather than committed, Expo versions chosen by `expo install`, and the Metro fallback for `.js` imports.

The engineers who build the app would have to repeat these decisions in every session, and a session that does not know them can undo one, for example by committing a generated `ios/` folder.
Source: `CLAUDE.md` and `.claude/rules/` on `main`, 2026-11-27; the mobile-app-skeleton spec (TOKI-146).

## Proposed outcome

- A Claude session that works on `apps/mobile` or `packages/ui-native` sees the mobile rules without being told, as a web session sees `.claude/rules/web.md`.
- `CLAUDE.md` describes the phone app where it describes the web app: the layout, the rule file list and the mobile commands.
- Each mobile rule names its source, and rules of the tool (Expo, React Native) are kept apart from rules of the project, as in the other rule files.

## Affected users and systems

- Users: the engineers who build the app, and the Claude sessions they open in the repository. No member sees this ticket's work. Source: Toki Blueprint, Mobile App Plan, intent IM01.
- Systems: `CLAUDE.md` and `.claude/rules/`. Source: Toki Blueprint, Mobile App Plan, MOB-01.

## Constraints

- Blueprint ticket MOB-01 "Claude setup for mobile", from web ticket TOKI-095. Scope: `apps/mobile` and `ui-native` in `CLAUDE.md`, a `.claude/rules/mobile.md` rule file, the mobile commands. Size S. Source: Toki Blueprint, Mobile App Plan, MM1, area Project setup.
- Milestone: MM1 "Mobile foundation and design system". Outcome: IM01, "A mobile app in the repository, with the same rules, tooling and CI as the web". Source: Toki Blueprint, Mobile App Plan.
- Every rule names its source: a rule in `CLAUDE.md`, the lint configuration, a merged spec, a workflow, or the official documentation of the tool, with a link. A rule of the tool is kept apart from a rule of the project. Source: `docs/intents/claude-rules-and-hooks.md` (TOKI-105), constraints.
- No command is added for code that does not exist yet. Source: the same intent, constraints.
- The change adds to `CLAUDE.md` and `.claude/settings.json` and removes nothing from them. The permission lists stay as they are. Source: the same intent, constraints.
- A boundary is changed only in `eslint.config.js` and `tools/lint-rules/`; the mobile boundaries themselves are MOB-04. Source: `CLAUDE.md`, "Boundary rules".
- No secret, token or personal path in any committed file. Source: `CLAUDE.md`, "Never do" 2.
- Not in this ticket: the mobile lint rules (MOB-04), the mobile configuration and secrets (MOB-02), CI (MOB-06) and the test harness (MOB-07). Source: Toki Blueprint, Mobile App Plan, MM1.

## Open questions

- Does this ticket wait until the `apps/mobile` skeleton (TOKI-146) is merged, so that its commands and rules describe code that exists?
- `packages/ui-native` does not exist yet. Is it named in `CLAUDE.md` and in the rule file's `paths` now, or by the ticket that creates it?
- Does the mobile rule file come with a hook, for example one that refuses an edit under `apps/mobile/ios` or `apps/mobile/android`, or is the ignore rule of git enough?
- Which official standards go into the "External standard" part of the rule file: Expo, React Native, Expo Router, or all three?
