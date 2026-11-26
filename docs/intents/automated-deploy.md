# Intent: Automated deploy
Author: Thanh Truong

## Problem
Once the production image and Compose file exist (TOKI-084), a release still reaches the server by hand: someone builds the images on the machine or copies them there, edits a tag, runs `docker compose up`, and reads the output to see whether it worked. Nothing builds an image when a change is merged, nothing says where the images are stored, nothing decides how the server is reached without leaving a password or a key in the wrong place, nothing runs the migrations before the new code starts in a way that can be stopped safely, and a bad release has no tested way back. The repository is public, so its workflow files and its run logs are readable by anyone: whatever the deploy does must work without a secret value in any file and without a log line that shows a person's data. Source: Toki Blueprint, TOKI-085 and the technical design (Infrastructure and deployment: "Merging to `main` builds an image and deploys; rollback uses the previous tag"); decisions D-020, D-092, D-107; the Plan changes of TOKI-084 and the hand-offs in TOKI-005, TOKI-064 and TOKI-096.

## Proposed outcome
A merged change becomes a published release, and a release can be put on the server and taken off it with one command, with the checks a person would do by hand done by the script:

- When the CI run of a commit on `main` passes, one workflow builds the server image and the web image of TOKI-084 from that commit and stores them in a registry under one tag that names the commit.
- One deploy workflow puts a release on the server: it checks the new release's configuration and migrations before the running release is touched, switches to it, waits for the server to be healthy, and checks that the site answers over HTTPS.
- A release that does not become healthy is replaced by the previous one without a person; a release found bad later is rolled back with one command. A rollback changes the images and nothing else: never the database, never the files, never `.env`.
- The server keeps its own secrets. The workflow files and the run logs hold no secret value and no person's data; the only credential GitHub holds is a key that can start the deploy script on the server and nothing else.
- Open pages and queued jobs are treated the way TOKI-084 and TOKI-064 decided: a few seconds without a connection, jobs finished or retried.

Whether a merge also starts the deploy by itself, or only a person does, is the open question D-190: the build on merge and every step of the deploy are the same either way. Source: plan, TOKI-085; technical design.

## Affected users and systems
- The operator of an installation (Thanh Truong for the first one), who deploys, rolls back and keeps the `.env` on the server.
- The builder, whose merged work becomes a release.
- Every end user, who sees a short loss of connection during a deploy and, in an open page, the update notice of TOKI-104.
- `.github/workflows/` (two new workflows), `.github/scripts/changed.sh` and `.github/workflows/ci.yml` (one new job), `tools/deploy/` (new), `docs/deploy.md` (new), `docs/environment-config.md` (the "How secrets are kept, Production" section and two rows).
- The GitHub repository settings and the GitHub Environment `production`, which the owner sets by hand.
- The tickets that meet this one: TOKI-084 (image, Compose, commands), TOKI-087 (installation guide), TOKI-091 (security review), TOKI-104 (update strip), TOKI-064 (worker), TOKI-096 (environment inventory).

## Constraints
- Milestone M6, size M. Needs TOKI-007 (CI) and TOKI-084 (production image). Source: Toki Blueprint, ticket TOKI-085.
- Scope: build the image on merge, deploy, run migrations, roll back. Source: plan, TOKI-085.
- Public access, Docker Compose on one VPS (2 vCPU, 4 GB, 80 GB); the firewall opens 80 and 443 for the app. Source: D-020, technical design.
- Rollback uses the previous tag. Migrations are forward-only, each one stays compatible with the previous release, and a rollback does not depend on a backup. Source: technical design; TOKI-005 concern 10; D-092.
- Migrations run as a step outside the server, before the server and the worker start; a retry in the deploy step belongs to this ticket. Source: TOKI-005 concern 4 and Errors; TOKI-084 R13.
- The worker's stop period is longer than 30 seconds; a job that did not finish is retried by the queue. Source: TOKI-064 R15 and concern 12; TOKI-084 R23.
- Secrets live in `.env` on the server, never in git; this ticket decides how the file gets there, who may read it and how it changes. Source: technical design; `docs/environment-config.md` ("How secrets are kept, Production"); TOKI-096 concern 9; TOKI-084 concern 2.
- The repository is public: workflow files and run logs are public. Source: GitHub repository `thanhtruong-agilityio/toki`.
- One tag names the server image and the web image built from one commit. Source: TOKI-084 concern 4.
- CI workflows use no secret and each job always starts and reports. Source: TOKI-007 R11, R16, R19.
- When a new version is deployed an open app shows 'Update available · Reload'. Source: D-107, NFR-17 (the strip is TOKI-104).
- No backup in phase 1. Source: D-092.
- The deploy is a trigger decision of the owner, and the installation guide of a fresh server is another ticket. Source: D-190 (open); TOKI-087.

## Open questions
- Is a deployment started automatically when a pull request is merged, or by hand? Source: D-190 (open; the log's text after the arrow is a proposal: by hand in phase 1, with one command).
- Where are the images stored, and under which tags? Source: TOKI-084 Out of scope and Plan changes.
- How does the server get the `.env`, and how does the deploy reach the server without a secret in the repository? Source: `docs/environment-config.md`; TOKI-096 concern 9; TOKI-084 concern 2.
- What exactly does a rollback undo? Source: TOKI-005 concern 10; TOKI-084 R13.
- How does a deploy change the version that an open app compares? Source: D-107; plan, TOKI-104.
