# Intent: Production image and Compose
Author: Thanh Truong

## Problem
Toki runs only on a builder's machine. The server is started with `tsx` and a root `.env`, the web app is served by the Vite dev server, and Postgres, MinIO and Mailpit run from a development Compose file that publishes their ports on the host. Nothing builds the server for production, nothing serves the built web app, nothing gives the browser an HTTPS address, and nothing says how the background worker, the migrations and the operator commands run next to the server. Several finished specs wait for this work: the sign-in link command for an operator, the worker process, the proxy rule for `/ws`, the headers of the manifest, the service worker and the icons, the way the browser reaches file storage, and the rule that the sample data of the prototype never reaches production. Without one installable unit, the installation guide, the automated deploy, the performance measurement and the security review have nothing to work on. Source: Toki Blueprint, TOKI-084; decisions D-020, D-092; the Plan changes of the merged specs of TOKI-026, TOKI-058, TOKI-064, TOKI-074 and TOKI-077.

## Proposed outcome
One Dockerfile builds the production images, and one Compose file starts the whole of Toki on one machine with `docker compose`: Caddy in front with automatic TLS, the app server, the background worker, Postgres and MinIO. Afterwards:

- A server with Docker, one domain name for the app, one for file storage and a filled `.env` serves Toki over HTTPS. Only Caddy is reachable from the internet, on ports 80 and 443.
- Migrations run on every `docker compose up`, before the server and the worker start; a failed migration leaves the running release as it was.
- The operator can run the commands of the server (the one-time sign-in link, the job status, the key generator) inside the running container.
- Caddy serves the web app and sets the headers that the manifest, the icons, the service worker, the hashed files and file storage need; a missing icon is a 404, not the app's start page.
- The production image holds none of the prototype's sample data.
- Each process receives only the configuration values it reads; the server never holds the private VAPID key.
- A rollback is starting the previous image tag.

Backup is not part of this work (D-092). Source: plan, TOKI-084; technical design, Infrastructure and deployment.

## Affected users and systems
- The operator of an installation (Thanh Truong for the first one), who installs and updates Toki.
- The builder, who can start the production stack on a laptop to try it.
- Every end user, who reaches Toki through this stack.
- `apps/server` (build script, health check command, configuration areas of each process), `apps/web` (its build output is served by Caddy), `docs/environment-config.md` and `.env.example`, `.github/workflows/ci.yml` (one new job).
- The tickets that build on it: TOKI-085 (automated deploy), TOKI-087 (installation guide), TOKI-089 (performance measurement) and TOKI-091 (security review).

## Constraints
- Milestone M6, size M. Needs TOKI-004 (server skeleton). Source: Toki Blueprint, ticket TOKI-084.
- Public access on its own domain with automatic TLS; Docker Compose on one VPS; the firewall opens only 80 and 443; Postgres and MinIO are not exposed to the internet; secrets live in `.env`, never in git. Source: D-020, technical design (Infrastructure and deployment), NFR-07.
- One VPS of 2 vCPU, 4 GB RAM and 80 GB of disk, for about 200 people. Source: technical design; NFR-04, D-009.
- Rollback uses the previous tag; migrations are forward-only and stay compatible with the previous release. Source: technical design; TOKI-005 concern 10.
- The migration command is a step outside the server; the server does not migrate at start. Source: TOKI-005 concern 4; TOKI-020 concern 9.
- The seed files of TOKI-081 stay out of the production image; a production installation starts with #general only. Source: plan, TOKI-084; D-031, D-147.
- The commands under `src/cli/` are built into the image (the sign-in link command is one). Source: plan, TOKI-084; TOKI-026 concern 12.
- The worker runs from the same image and codebase as the server, with a stop grace period longer than 30 seconds. Source: TOKI-064 concern 12.
- Caddy passes `/ws` with the upgrade and does not close an idle connection before 30 seconds. Source: TOKI-038 concern 8.
- The manifest, the icons and the service worker have fixed headers and a 404 for a missing icon; the build stage installs the `apps/web` devDependencies with the `sharp` platform package. Source: TOKI-077 concern 8 and Plan changes; TOKI-074 R19 and Plan changes.
- The browser reaches file storage on a host that is not the origin of the app, with `nosniff`, `Content-Security-Policy: sandbox`, the preflight answered and no query string in the log. Source: TOKI-058 concern 10 and Plan changes; TOKI-062 (attachment viewer) and TOKI-063 (Files tab), hand-offs in their Plan changes.
- No backup in phase 1. Source: D-092.
- A fresh server reaches a working sign-in page from the documented steps alone. Source: NFR-07 (the guide is TOKI-087).

## Open questions
- Does one image run both the server and the worker? Source: TOKI-064 concern 1, answered there for the code; this work decides the Compose side.
- Which host name does file storage use, given that it must not be the origin of the app? Source: TOKI-058 concern 10.
- Where do the production `.env` values come from, and which process reads which? Source: `docs/environment-config.md`, "How secrets are kept".
- Does a merge deploy by itself or by hand? Source: D-190 (open); the question belongs to TOKI-085.
