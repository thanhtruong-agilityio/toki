# Intent: Installation guide
Author: Thanh Truong

## Problem
Toki is self-hosted: each company runs its own copy on one VPS. The production images and the Compose file will exist (TOKI-084), but a person who has a fresh server, a domain and a mail account still has no written path from there to a working sign-in page. Three things are easy to get wrong without one: the mail settings, the first Admin (who comes from server configuration and is created only once), and what to do when mail cannot be sent. Source: Toki Blueprint, requirement NFR-07 and decisions D-020, D-027, D-028, D-159.

## Proposed outcome
One guide in the repository that a person can follow from a fresh server to the sign-in page of their own installation: the machine, DNS, the firewall, the code, the `.env` file, the first start, the first sign-in, and the command that prints a one-time sign-in link when mail cannot be sent. The guide points to the inventory of configuration values (`docs/environment-config.md`, `.env.example`) and does not keep a second list. A check fails when the guide names a command or a variable that does not exist. Source: NFR-07, D-027, D-028, D-159, TOKI-096.

## Affected users and systems
- Whoever installs and runs a Toki server (the operator), who is not necessarily a developer of Toki.
- The first Admin, who signs in once the guide is done.
- Documents and checks only: no server or web code changes.
- Neighbouring work the guide relies on: the production image and Compose file (TOKI-084), the environment inventory (TOKI-096), the first Admin (TOKI-020), SMTP mail (TOKI-021), the one-time link command (TOKI-026), Web Push keys (TOKI-074).

## Constraints
- Blueprint ticket TOKI-087, size S, milestone M6. The plan lists it as needing TOKI-026, TOKI-084 and TOKI-096. Source: Toki Blueprint, ticket list.
- A fresh server reaches a working sign-in page from the documented steps alone. Source: NFR-07.
- Phase 1 is one VPS (2 vCPU, 4 GB RAM, 80 GB SSD) running Docker Compose, reachable from the public internet on its own domain, with automatic TLS. Source: D-020, NFR-07, technical design.
- Mail goes through configurable SMTP; the guide says which settings to give. Source: D-027.
- The first Admin is created from server configuration, not from a set-up page. Source: D-028.
- When mail cannot be sent, a person with server access prints a link valid 10 minutes for one member; every use is logged. Source: D-159.
- No backup or restore steps in this phase. Source: D-092.
- The guide points to the `.env.example` built in TOKI-096 and writes no second list of variables. Source: Toki Blueprint, ticket TOKI-087.
- The guide holds no secret and no real value. Source: TOKI-096 (secrets live in `.env`, never in git).

## Open questions
1. Where does the guide live, and how is it kept true when a command or a variable changes?
2. Which operating system and which way of getting the code does the guide assume?
3. Which mail account does the guide show, given that D-027 fixes only "configurable SMTP"?
4. What does the operator do when the first Admin's address was mistyped, given that the values are used only once?
5. How is "a fresh server reaches a working sign-in page" shown to be true?
