# Intent: Web app skeleton

Author: Thanh Truong

## Problem

Toki phase 1 is core chat on the web, but the web app does not exist yet. Nothing has been committed to the repository. There is no running web app that later screens can be added to, and no way for the web app to reach the server during development. Until this exists, the test harness and every later web screen have nothing to build on.

## Proposed outcome

- The builder can start the web app in development and see an empty page in the browser.
- The web app has a place for pages and navigation, so later screens are added to it rather than set up from scratch.
- The web app has a place for loading data from the server, so later screens use it rather than invent their own.
- In development, requests from the web app reach the server.
- The work fits the milestone goal: later screens are assembled rather than invented.

## Affected users and systems

- Users: the builder (one person building with Claude). Source: Toki Blueprint, intent I01 repo-foundation.
- Systems: the web app (`apps/web`) in the Toki monorepo, and its development connection to the server (`apps/server`). Source: Toki Blueprint, technical design.
- No end user of Toki is affected yet; the page is empty.

## Constraints

- Scope given by the Blueprint: router, Query, an empty page, dev proxy to the server. Source: Toki Blueprint, ticket TOKI-006.
- Agreed web stack: React, Vite, TanStack Router and Query. Source: Toki Blueprint, technical design (Stack) and ticket TOKI-006.
- The web app lives in `apps/web` in the one monorepo (phase 1). Source: Toki Blueprint, technical design (Code structure).
- Boundary rules apply: `client-core` touches no DOM or browser API, and components reach platform features only through `platform` (lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web`). Source: Toki Blueprint, technical design.
- Phase 1 acceptance criterion that touches this ticket: initial JavaScript under 200 KB compressed. Source: Toki Blueprint, phase 1 acceptance criteria.
- The server API is versioned under `/api/v1`. Source: Toki Blueprint, technical design.
- Milestone: M1 Foundation and design system. Exit check for the milestone: `pnpm dev` runs, CI is green, and the component preview page matches the prototype. Source: Toki Blueprint, milestone M1.
- Size: S (about half a working session with Claude). Source: Toki Blueprint, ticket TOKI-006.
- Needs: TOKI-001 (pnpm monorepo and TypeScript). Source: Toki Blueprint, ticket TOKI-006.
- Needed by: TOKI-008 (test harness), TOKI-010 (self-hosted fonts) and TOKI-011 (icon set). Source: Toki Blueprint, ticket list, Needs column.
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008. Source: Toki Blueprint, intent list.

## Open questions

None.
