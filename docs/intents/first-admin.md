# Intent: First admin from environment variables
Author: Thanh Truong

## Problem
A new Toki installation has an empty database: no workspace, no account and no channel. Sign-in is by a code sent to a member's address, and people join only by an invitation from an Admin, so with no account nobody can sign in and nobody can invite. Something outside the app must create the first Admin, the workspace they belong to and the #general channel that every member is in. Source: Toki Blueprint, decisions D-028 and D-153, flow F01, requirement FR-05.

## Proposed outcome
When the server starts on an empty database it creates the workspace, the first Admin account and #general from environment variables. The first Admin signs in with a code like anyone else and invites the others. When the database already has data, nothing is created or changed. #general exists from the first moment, every member is in it, and it cannot be left or archived. Source: Toki Blueprint, decisions D-028, D-034, D-153, flow F01, FR-05 (AC-015, AC-016).

## Affected users and systems
- Whoever installs and operates a Toki server: they set the variables.
- The first Admin, who signs in and invites the rest.
- The server (`apps/server`), the account tables (TOKI-019) and the conversation tables (TOKI-028).
- Later work that reads the result: sign-in (TOKI-022), member management (TOKI-024), accepting an invitation (TOKI-097), the installation guide (TOKI-087).

## Constraints
- Blueprint ticket TOKI-020, size S, milestone M2. The plan lists it as needing TOKI-019. Source: Toki Blueprint, ticket list.
- There is no Owner role: the first account is an Admin (Member and Admin are the phase 1 roles). Source: D-152, D-153.
- The first Admin comes from server configuration; the variable names are those of the configuration inventory (TOKI-096). Source: D-153, TOKI-096.
- A required variable that is missing stops the server, which prints the name of the variable. Source: flow F01.
- A database that already has accounts is left alone: the setup variables are ignored, nothing is created or changed. Source: flow F01.
- Every workspace has a #general channel created at set-up; every member is in it automatically; it cannot be left or archived. Source: D-034, FR-05.
- Each installation is one company: one workspace (single-tenant, `workspace_id` kept in the schema). Source: D-004.
- A display name is 1 to 80 characters. Source: D-033.
- English is the default language. Source: D-018.
- Server modules call each other only through public interfaces, never each other's tables. Source: Toki Blueprint, boundary rules.
- The first Admin's address is personal data: it is not committed (source: TOKI-096 R9) and is not written to a log. The second half is this intent's own rule: no decision of the log covers a start-up line, and TOKI-004 R7 covers only request logs.

## Open questions
1. Which variables does set-up read, and which are required? The Blueprint names none; TOKI-096 lists a first admin email, a first admin name and a workspace name.
2. What name does the first Admin get? D-150 takes the part of the address before the @ for a newcomer; the inventory also has a first admin name.
3. What happens when the database is not empty, when two server processes start together, and when set-up fails half way?
4. Where in server start-up does it run, relative to the migrations?
5. What does the log hold about the set-up, given that the address is personal data?
6. Does #general start with a topic or a description? The prototype's #general has both, but D-147 says sample content is illustration only.
7. Who builds what the first Admin sees on first entry (the line "This is the start of #general" and the card of three suggestions of flow F01)?
