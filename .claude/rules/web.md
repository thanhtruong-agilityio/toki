---
paths:
  - "apps/web/**"
  - "packages/ui-web/**"
---

# Web rules

Each statement is followed by its source. Rules of this project come first; rules of the tool are kept apart in "External standard".

## This project

- Routes are defined in code under `apps/web/src/routes/`, not from files; the router is created in `apps/web/src/router.tsx` only.
  Source: `docs/specs/2026-11-12-web-skeleton-design.md`, R3.
- There is one Query client, created in `apps/web/src/query-client.ts`; `new QueryClient(` appears nowhere else.
  Source: web-skeleton spec, R5.
- In development `/api/v1/*` is proxied to the server port from the root `.env`; there is no separate proxy target variable.
  Source: web-skeleton spec, R6 and R7.
- `packages/ui-web` reaches notifications, storage, the service worker and audio only through the `platform` package, and plays sound without an `<audio>` element. Lint checks this; file picking and a renamed copy of `window` are left to review.
  Source: lint rule `toki/platform-apis` and the `no-restricted-syntax` block for `packages/ui-web` in `eslint.config.js`.
- Lint does not check `apps/web`; at the time of the ticket `apps/web/src` held none of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio` and `AudioContext`, and review is what keeps it so.
  Source: web-skeleton spec, R12.
- The component preview page of the design system exists in development only: `pnpm --filter @toki/web dev`, then `http://localhost:5173/preview.html?look=calm&accent=teal`.
  Source: `docs/specs/2026-11-16-component-preview-design.md`.
- `pnpm --filter @toki/web run check:no-dev-pages` checks that no dev-only page is in the web build. The web build runs it last; a dist folder can be given with `-- --dist <dir>`.
  Source: `apps/web/package.json`; `apps/web/scripts/check-no-dev-pages.mjs`.

## External standard

- Do not use an Effect to compute a value from props or state; compute it while rendering.
  Source: [React, You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
- Keep what an interaction causes (a click, a submit) in the event handler, not in an Effect.
  Source: same page.
- Reset the state of a component by giving it a different `key`, not with an Effect.
  Source: same page.
- Subscribe to an external store with `useSyncExternalStore`, not with an Effect.
  Source: same page.
