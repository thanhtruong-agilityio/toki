# Intent: Prototype seed data
Author: Thanh Truong

## Problem
After `pnpm dev:reset:db` the development database holds tables and no row. The builder has no people to sign in as, no channel to open and no message to scroll, so every screen of the message feed (list, thread, reactions, pins) has to be tried against hand-typed rows. The end-to-end flows also need a known workspace to start from. The prototype already draws one: Hugepig Studio, eight people, channels, direct messages and a day and a half of conversation. A production installation must not get any of it: it starts with #general only. Source: Toki Blueprint, TOKI-081 and decisions D-031, D-147.

## Proposed outcome
A command `pnpm dev:seed` loads the prototype's sample workspace into an empty development database: the workspace, eight people (roles Member and Admin only), the sample channels, direct messages and a group, their messages, one thread, reactions and one pin. After `pnpm dev:reset:db`, `pnpm dev:seed` and `pnpm dev`, the builder can sign in as any of the eight people with the code from the Mailpit inbox and find the conversations in place. The command refuses to run outside development, never writes to a database that holds other data, and run twice leaves the data as the first run left it. Sample files and images join the seed in TOKI-063, once file storage exists. Source: plan, TOKI-081; D-031, D-147, D-152.

## Affected users and systems
- The builder, who runs the command after a reset.
- The end-to-end flows (TOKI-090), which start from the seeded workspace.
- The server (`apps/server`) and the modules that own the tables the seed fills: workspace, members, conversations, messages, reactions.
- The root scripts and `scripts/` (the `dev:*` commands of TOKI-003).

## Constraints
- The sample is Hugepig Studio with the prototype's 8 people, whose roles are Member and Admin only: there is no Owner. Source: D-031, D-152.
- It is for development and tests. It never runs in production, which starts with #general only. Source: D-031, D-147.
- The only reactions are the 8 fixed emoji; the prototype's sample reaction 👋 is not one of them. Source: D-017, FR-35 (TOKI-046).
- A message holds 1 to 10,000 characters; a thread is one level deep. Source: D-042, TOKI-036, TOKI-037.
- A Guest is a phase 5 role; the account tables accept Member and Admin only. Source: D-152, TOKI-019 R9.
- Sample files and images are added by TOKI-063, not here. Source: plan, TOKI-063.
- The sample holds no real person's email address. Source: the rule that tests and fixtures use fake addresses (TOKI-020, "Data safety").
- Ids are UUIDv7 made with the generator of `packages/shared`, and time comes from the injected clock. Source: TOKI-098, TOKI-008 R19.
- Server modules call each other only through public interfaces, never each other's tables. Source: technical design, boundary rules; `.claude/rules/server.md`.
- A reset wipes data; the seed fills an empty database, and the order (wipe, seed, start) belongs to this ticket. Source: first-admin spec, concern 13; TOKI-003.
- Needs TOKI-045, TOKI-046, TOKI-048 and the built first admin, account tables, conversation tables, local development environment and messages tables. Milestone M3, size M. Source: plan.
- Belongs to Blueprint intent I06 realtime-messaging.

## Open questions
1. Which parts of the prototype's data may the seed not contain, and why?
2. How does the seed treat the sample reaction 👋, which the 8 fixed emoji do not include?
3. How is the data written: through module entries, through the HTTP routes, or as SQL?
4. What does the command do when the server already ran its first set-up, when it is run twice, and in production?
5. Which ticket adds the data that later tickets create (profile fields, unread counts, attachments other than files and images) to the seed?
