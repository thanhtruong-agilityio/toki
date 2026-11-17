# Intent: Sessions and emergency access (server)
Author: Thanh Truong

## Problem
A signed-in person cannot see where they are signed in, and cannot end a session on a device they no longer hold. A lost phone, or a laptop left open at work, stays signed in for 30 days without use.
Separately, sign-in depends on mail. When the mail server is down, nobody can get a code, and the only person who could help has no way to let a member in.
The sign-in API (TOKI-022) starts and ends sessions, but nothing lists them, ends one chosen session, or lets an operator with server access start a session without a code.

## Proposed outcome
A signed-in person reads the list of their own sessions with the kind of device, the browser and the last use of each, sees which one is the device in use, and can end one other session or all other sessions. A session ended this way is refused on its next request.
A person with access to the server runs one command with a member's email address and gets a one-time sign-in link that works for 10 minutes. Opening it signs that browser in as the member without a code. Every use is written to the log.

## Affected users and systems
- Users: Member and Admin, each for their own sessions only. Source: journey F06, FR-47.
- The operator of an installation, who has shell access to the server, for the emergency command. Source: journey F43, FR-49.
- Systems: the Toki server (`apps/server`, the `auth` module) and the data contracts in `packages/shared`.
- Uses: the `sessions` table (TOKI-019) and the sign-in API (TOKI-022): the session check, the functions that create and end sessions, and the session cookie.
- Used by: the Preferences section "Signed-in devices" and the sign-out confirmation (TOKI-099), the Admin page's "last active" column (TOKI-025, through the last use per person, which TOKI-024 provides), and the web page that opens the emergency link (built in this ticket, see its spec).

## Constraints
- Belongs to Blueprint intent I03 sign-in-by-email-code, alongside TOKI-019, 020, 021, 022, 023 and 099. Source: Toki Blueprint, intent list.
- Milestone: M2, Sign-in, members and conversations. Source: Toki Blueprint, milestone M2.
- Size: S. Source: Toki Blueprint, ticket TOKI-026.
- Needs: TOKI-022. Source: Toki Blueprint, ticket dependencies.
- Agreed scope: list your own sessions with device kind, browser and last use; sign out one device or all others; a session ended this way is refused on its next request; a server command prints a one-time sign-in link valid 10 minutes for one member, refuses an address that is not in the workspace or is deactivated, and logs every use. Source: Toki Blueprint, ticket TOKI-026; D-158, D-159.
- Each row of the list shows the device kind, the browser and the last use; the device in use is marked; signing out another device and signing out all other devices each ask for confirmation (the screen's job). Source: journey F06, FR-47, D-158.
- After signing out another device, that device can no longer read or write anything until someone signs in on it again, and its row is gone. Source: FR-47 AC-134.
- Signing out on one device leaves the person signed in on their other devices; the other tabs of the same browser share the session. Source: D-093, FR-46.
- The emergency link is valid 10 minutes, works once, is made for one member and is the only sign-in without a code. Source: D-159, FR-49.
- The command prints no link for an address that is not a member or belongs to a deactivated person, and every use is written to the server log. Source: journey F43, FR-49 AC-141.
- The link is never sent by mail and a sign-in mail never carries one. Source: D-157.
- A session started from the link is a session of the same kind as any other. Source: TOKI-022 (one function creates sessions).
- Nothing is readable without a session; a person sees and ends only their own sessions. Source: BR-01, FR-47.
- The API lives under `/api/v1`; within a version, fields are only added; errors use the one error format. Source: Toki Blueprint, technical design; TOKI-004.
- There are two roles in phase 1, Member and Admin; there is no Owner. Source: D-152.
- English is the default interface language; the server's error messages are English and untranslated. Source: D-018; TOKI-004.

## Open questions
- Does a session started from the emergency link last 30 days like any other? The log has D-179 as Open, with a proposal: a normal 30-day session.
- Does printing a new link cancel an earlier unused one? The log has D-179 as Open, with a proposal: yes, as a new code does (D-082).
- Which ticket builds the web page that opens the link? The plan names none: the link is a sign-in without a code, and a plain request to a page must not create a session (TOKI-022 concern 9).
- What does the list show for a device whose user agent says nothing useful (an app, an empty value)? The log fixes the three items of a row and gives no word for an unknown one.
- Is "server log" met by a line in the output of the command, or must it reach the log of the running server?
