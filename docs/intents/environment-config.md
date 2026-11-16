# Intent: Set up configuration for each environment
Author: Thanh Truong

## Problem
Toki needs a set of configuration values to run in each environment. Today there is no complete list of these values, and nothing is committed to the repository yet. Without the list, the builder and whoever operates the server cannot tell which values are needed, which are still missing, or who must supply them. Source: Toki Blueprint, intent I17 environment-config ("Want").

## Proposed outcome
There is a complete list of every configuration value Toki needs, with real values in hand for each environment. Every required value exists for development. Every required value has a named owner for production. Source: Toki Blueprint, intent I17 ("Want" and "Done").

## Affected users and systems
- The builder (one person building with Claude).
- Whoever operates the server.
- Later work that reads configuration: the server skeleton (TOKI-004) reads and validates environment variables.
Source: Toki Blueprint, intent I17 ("Who") and ticket TOKI-004.

## Constraints
- This is Blueprint intent I17 environment-config. It has one ticket by decision: TOKI-096. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Its goal includes "its configuration is known". Source: Toki Blueprint, milestone M1.
- Size: M (about one working session with Claude). Source: Toki Blueprint, ticket TOKI-096.
- Needs: no other ticket. Needed by: TOKI-004 (Fastify server skeleton) and TOKI-087 (Installation guide, M6). Source: Toki Blueprint, ticket table, Needs column.
- Scope fixed by the ticket. Source: Toki Blueprint, ticket TOKI-096.
  - An inventory of every environment variable: name, purpose, required or not, default, who supplies it.
  - `.env.example` matching the inventory.
  - The list of values that must come from outside: domain, mail account, VPS, backup storage.
  - How secrets are kept per environment.
- Secrets live in `.env`, never in git. Source: Toki Blueprint, technical design, Infrastructure.
- Given facts that shape the list. Source: Toki Blueprint, technical design, Infrastructure.
  - Each company runs its own copy on one VPS (single-tenant, self-hosted).
  - Mail goes through configurable SMTP. Development uses Mailpit.
  - The first admin and the #general channel are created from environment variables when the database is empty.
- This file holds no secret and no real credential value.

## Open questions
1. Which account sends sign-in emails? Left open in the Blueprint, to be decided before the phase 1 deploy. Suggested there: a company Google account.
2. Which VPS provider and region? Left open in the Blueprint, to be decided before the phase 1 deploy.
3. Which environments are in scope? The Blueprint names development and production only.
4. Who are the named owners of the production values? The Blueprint asks for an owner per value but names none.
5. What are the domain and the backup storage? The ticket lists both as values from outside; the Blueprint gives no value or owner.
6. Can this ticket close while questions 1 and 2 are open, given that neither blocks phase 1?
