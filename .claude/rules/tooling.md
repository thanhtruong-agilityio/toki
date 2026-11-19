---
paths:
  - "scripts/**"
  - "tools/**"
  - ".claude/**"
  - "eslint.config.js"
  - "docker-compose.dev.yml"
---

# Tooling rules

Each statement is followed by its source. All of them are rules of this project.

## Development services

- `pnpm dev:up` starts Postgres, MinIO and Mailpit and waits until all three are healthy. It needs Docker and a root `.env`. The first run builds the MinIO image from source: a few minutes and about 3 GB of free Docker disk. `pnpm dev:down` stops them; their data stays in the named volumes.
  Source: `scripts/up.sh`, `scripts/down.sh`, `docker-compose.dev.yml`.
- `pnpm dev:reset` wipes all three stores; `dev:reset:db`, `dev:reset:files` and `dev:reset:mail` wipe one. Each refuses unless `NODE_ENV` is `development`. `dev:reset:db` then applies every migration, so the tables exist and hold no row.
  Source: `scripts/guard.sh` and the `scripts/reset*.sh` files.
- `bash scripts/smoke.test.sh` tests the reset scripts. Part 1 (the guard) needs no Docker; part 2 needs the services up and WIPES the development data. Run it whenever a script in `scripts/` changes.
  Source: `scripts/smoke.test.sh`.

## Lint rules

- `pnpm test:lint-rules` tests the lint rules of `tools/lint-rules/`: the name on an icon-only button and the import ban on the web implementation of `platform`.
  Source: root `package.json`.
- A boundary is changed in `eslint.config.js` and `tools/lint-rules/` only.
  Source: header comment of `eslint.config.js`.

## Claude hooks

- `check-branch-slug.sh` refuses `git push` and `gh pr create` from a branch with no slug (for example `feat/toki-002`). Rename the branch before its pull request is opened; a later rename closes the pull request.
  Source: `.claude/hooks/check-branch-slug.sh`.
- `block-lockfile-edit.sh` refuses an Edit or Write of `pnpm-lock.yaml` (not a change made through the shell); change the lock file through `pnpm`.
  Source: `.claude/hooks/block-lockfile-edit.sh`.
- `format-after-edit.sh` runs Prettier on a file after an edit and never fails the call.
  Source: `.claude/hooks/format-after-edit.sh`.
- `notify-on-finish.sh` shows a desktop notification when Claude finishes a turn (`osascript` on macOS, `notify-send` on Linux, nothing elsewhere). It runs in the background and always exits 0.
  Source: `.claude/hooks/notify-on-finish.sh`.
- `bash .claude/hooks/hooks.test.sh` tests the first three hooks: it feeds each one a tool call and checks the exit code. Run it whenever a hook changes.
  Source: `.claude/hooks/hooks.test.sh`.
