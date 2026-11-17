# Environment configuration

The complete list of the configuration values Toki needs in phase 1, the values that must come from outside, and the rules for keeping secrets. The matching file with the development values is [`.env.example`](../.env.example) at the repository root. Spec: [`docs/specs/2026-11-12-environment-config-design.md`](specs/2026-11-12-environment-config-design.md) (TOKI-096).

Two environments are covered: development and production. The test database connection (`TEST_DATABASE_URL`) is listed because tests read it; its value in CI is written in the CI workflow, not here.

## Adding a variable

The ticket that needs a new variable adds its row to the inventory below and its line to `.env.example` in its own pull request. The two files list the same names: sort the names of each and compare them. TOKI-087 (installation guide) points to this file and keeps no second list.

## Inventory

Columns:

- **Read by**: server (TOKI-004), compose (TOKI-003), tests (TOKI-008).
- **Required**: `yes` means unset and empty both count as missing. The server stops when one of its required variables is missing; compose stops with the name of the missing one.
- **Default**: the value used when the variable is unset. It is safe in every environment, production included, or `none`. Never a secret. The development compose file (TOKI-003) reads every value it needs with no fallback, so for its port rows a default holds only for the readers that apply it; compose stops with the name when the variable is missing from `.env`. The Mailpit and MinIO console ports have no default: their values are not yet fixed (spec concern 12).
- **Development value**: the value `.env.example` holds. `empty` for a secret: the builder chooses a throwaway local value when filling `.env`.
- **Supplied by**: who provides the value in production. "Thanh Truong" owns the value of the first installation; "the operator of that installation" is the role for a value that differs per installation. A row that no production process reads says "not read in production".
- **Secret**: `yes` means the value is never written in a committed file, a ticket, a pull request, a log or a chat.

### Server

| Name | Purpose | Read by | Required | Default | Development value | Supplied by | Secret |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `NODE_ENV` | Environment name: `development` or `production`. The reset scripts refuse to run unless it is `development`, and the server refuses clear-text mail unless it is `development`. Vite and Vitest set this name themselves in their own processes | server, compose | yes | none | `development` | Thanh Truong | no |
| `SERVER_PORT` | Port the server listens on. The web dev server proxy for `/api/v1` aims at this port | server, web dev server | no | `3000` | `3000` | Thanh Truong | no |
| `SERVER_HOST` | Address the server binds to. Containers set `0.0.0.0` through their environment. Never `localhost` | server | no | `127.0.0.1` | `127.0.0.1` | Thanh Truong | no |
| `LOG_LEVEL` | Log level: `fatal`, `error`, `warn`, `info`, `debug` or `trace` | server | no | `info` | `info` | Thanh Truong | no |

The web dev server has no variable of its own: it listens on the fixed port 5173 (TOKI-006, `strictPort`), so the default development ports are web 5173 (fixed), Postgres 5432 (`POSTGRES_PORT`), MinIO 9000 (`MINIO_PORT`) and server 3000 (`SERVER_PORT`). Its proxy for `/api/v1` is derived from `SERVER_PORT`.

### Database

The app connection is one URL. There are no separate rows for its host, port, user, password and name.

| Name | Purpose | Read by | Required | Default | Development value | Supplied by | Secret |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `DATABASE_URL` | Postgres connection URL of the app database | server | yes | none | empty | Thanh Truong | yes |
| `TEST_DATABASE_URL` | Postgres connection URL of the test database (the second database `POSTGRES_TEST_DB`, on the same development Postgres server) | tests | yes | none | empty | not read in production | yes |
| `POSTGRES_USER` | User of the development Postgres service | compose | yes | none | `toki` | not read in production | no |
| `POSTGRES_PASSWORD` | Password of that user | compose | yes | none | empty | not read in production | yes |
| `POSTGRES_DB` | Name of the development database | compose, dev scripts | yes | none | `toki` | not read in production | no |
| `POSTGRES_TEST_DB` | Name of the test database. The reset guard reads it; it must differ from `POSTGRES_DB` and end in `_test` | compose, dev scripts | yes | none | `toki_test` | not read in production | no |
| `POSTGRES_PORT` | Host port of the development Postgres service | compose | no | `5432` | `5432` | not read in production | no |

### File storage (S3-compatible; MinIO in development)

| Name | Purpose | Read by | Required | Default | Development value | Supplied by | Secret |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `MINIO_ROOT_USER` | Root user of the development MinIO service | compose, dev scripts | yes | none | `toki` | not read in production | no |
| `MINIO_ROOT_PASSWORD` | Password of that user (MinIO needs at least 8 characters) | compose, dev scripts | yes | none | empty | not read in production | yes |
| `MINIO_BUCKET` | Name of the development bucket | dev scripts | yes | none | `toki-dev` | not read in production | no |
| `MINIO_PORT` | Host port of the MinIO S3 API | compose | no | `9000` | `9000` | not read in production | no |
| `MINIO_CONSOLE_PORT` | Host port of the MinIO console | compose | yes | none | `9001` | not read in production | no |

### Mail over SMTP (Mailpit in development)

Names and flags follow the mail spec (TOKI-021). `SMTP_TLS` defaults to `starttls`, so a server with the variable unset never sends in clear; `none` is accepted only when `NODE_ENV` is `development`.

| Name | Purpose | Read by | Required | Default | Development value | Supplied by | Secret |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `SMTP_HOST` | Address of the SMTP server | server | yes | none | `127.0.0.1` | the operator of that installation (see [External values](#external-values), mail account) | no |
| `SMTP_PORT` | Port of the SMTP server. In development it is the port Mailpit publishes, the same number as `MAILPIT_SMTP_PORT` | server | yes | none | `1025` | the operator of that installation (see [External values](#external-values), mail account) | no |
| `SMTP_TLS` | `none`, `starttls` (upgrade required) or `tls` (TLS from the first byte) | server | no | `starttls` | `none` | the operator of that installation (see [External values](#external-values), mail account) | no |
| `SMTP_USER` | Login of the SMTP account. Set together with `SMTP_PASSWORD`, or neither | server | no | none | empty | the operator of that installation (see [External values](#external-values), mail account) | no |
| `SMTP_PASSWORD` | Password of that login | server | no | none | empty | the operator of that installation (see [External values](#external-values), mail account) | yes |
| `MAIL_FROM_ADDRESS` | Sender address of the mail the server sends | server | yes | none | `toki@example.com` | the operator of that installation (see [External values](#external-values), mail account) | no |
| `MAIL_FROM_NAME` | Sender name | server | no | `Toki` | `Toki` | the operator of that installation | no |
| `MAILPIT_SMTP_PORT` | Host port of the development Mailpit SMTP service | compose | yes | none | `1025` | not read in production | no |
| `MAILPIT_WEB_PORT` | Host port of the development Mailpit web page | compose | yes | none | `8025` | not read in production | no |

### First installation

Flow F01 (TOKI-020) reads these three values to create the workspace, the first admin and #general when the database is empty. TOKI-020 reads exactly these names. The first admin email is personal data: development holds a fake address on a reserved test domain.

| Name | Purpose | Read by | Required | Default | Development value | Supplied by | Secret |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `FIRST_ADMIN_EMAIL` | Email address of the first admin | server | yes | none | `admin@example.test` | the operator of that installation | no |
| `FIRST_ADMIN_NAME` | Display name of the first admin | server | yes | none | `Test Admin` | the operator of that installation | no |
| `WORKSPACE_NAME` | Name of the workspace created for the installation | server | yes | none | `Toki Dev` | the operator of that installation | no |

### Domain

| Name | Purpose | Read by | Required | Default | Development value | Supplied by | Secret |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `APP_DOMAIN` | Domain name the installation is served on | production compose (TOKI-084) | yes | none | `localhost` | the operator of that installation (see [External values](#external-values), domain) | no |

### Backup storage

No variable in phase 1. Backup is deferred to a later phase (Blueprint decision D-092); where backups are stored and how that is configured are decided with it.

## External values

Values the builder cannot invent and that someone must provide before the phase 1 deploy. The owner here is the source for the rows of the inventory that point to this list. None of them blocks the merge of TOKI-096.

| Value needed | Owner | Status | Needed before |
| :-- | :-- | :-- | :-- |
| Domain (`APP_DOMAIN`) | Thanh Truong | open | Phase 1 deploy |
| Mail account (the `SMTP_*` rows and `MAIL_FROM_ADDRESS`): the first installation sends sign-in mail from Thanh Truong's own Gmail account. The address and its password are kept only in the production `.env` | Thanh Truong | open | Phase 1 deploy |
| VPS (provider and region) | Thanh Truong | open | Phase 1 deploy |

## How secrets are kept

Secrets live in `.env`, never in git. `.gitignore` ignores `.env` and `.env.*`, and keeps `.env.example` (TOKI-001).

### Development

- `.env` lives in the root of the builder's checkout (a second worktree needs its own copy). Create it with `cp .env.example .env` and fill every empty required value.
- Only the builder who owns that checkout reads it.
- It is never committed. A secret in development is a throwaway local value chosen by the builder; no development service supplies it.
- No secret is pasted into a ticket, a pull request, a log or a chat.

### Production

- Each installation has its own `.env` on the server of that installation. It is never committed.
- Its exact place on the server, who may read it, how it is backed up and where the deploy gets its secrets are decided in TOKI-085 "Automated deploy".
