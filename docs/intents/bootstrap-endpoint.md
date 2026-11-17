# Intent: Bootstrap endpoint
Author: Thanh Truong

## Problem
When a person opens Toki, the app needs to draw the sidebar at once: the person's own name, the workspace name, the people the person can talk to, and the conversations the person belongs to, each with its own star, mute and notification level.
Today nothing returns these together. Without one call the app would send one request per list, show the shell in pieces, and risk a screen that mixes data read at different moments (a conversation whose DM partner is not in the people list yet).
The app also has to know where it stands in the stream of live events, so that what happens after the first load can be applied exactly once and what happened during it is not lost or applied twice.
The tables that hold conversations and members exist (conversation tables), and the channel and direct-message requests decide who belongs to what, but no request returns the result to the app.

## Proposed outcome
One request, `GET /api/v1/bootstrap`, returns for the signed-in person: the person's own account, the workspace, every person of the workspace (name, role, active or deactivated), every conversation the person belongs to and that is not archived, and the current event number.
Each conversation carries what the list needs to be drawn and grouped: kind, name or members, topic, private flag, #general flag, and the person's own notification level, mute and star.
All of it is read at one moment, so the lists agree with each other and with the event number.
Everything the person is not allowed to see stays out: other people's email addresses, private channels and DMs the person is not in, public channels not joined, and archived channels.
The shapes are written once in `packages/shared`, so the server and the client-core API client use the same definitions.
Unread counts and the order of direct messages by latest message need messages, which do not exist yet; they are added by the tickets that build messages and the read pointer.

## Affected users and systems
- Members and Admins: the first load of the app (journey "Open the app: the Home view").
- The server app (`apps/server`): one new route and a small piece of code that gathers data from the `workspace`, `members` and `conversations` modules, and one read added to each of the last two.
- The shared package (`packages/shared`): the response schemas.
- The sign-in work (TOKI-022), whose session check guards the route and whose `User` shape the response reuses.
- The conversation tables (TOKI-028), the channel API (TOKI-029) and the direct-message API (TOKI-030), which decide what conversations and members exist.
- Later tickets that read or extend the response: the client API and conversation store (TOKI-032), the conversation list (TOKI-033), the messages and events tables (TOKI-036), the message API (TOKI-037), reconnect (TOKI-039) and the read pointer (TOKI-053).

## Constraints
- All conversations come with the call in phase 1, with no limit; the choice is revisited past 500 conversations. Source: Toki Blueprint, decision D-117.
- The endpoint name and shape are fixed in this ticket's spec, under `/api/v1`. Source: D-125.
- A person cannot see the content of a channel they have not joined, a private channel or a DM they are not in. Source: D-116, BR-09.
- An archived channel leaves everyone's list. Source: flow F26, D-029.
- A DM appears in the other person's list only when the first message is sent; an existing DM with a deactivated person keeps its place and its history. Source: flow F25, F41, D-091, D-094.
- The list shows Starred, Channels and Direct messages; notification level defaults to "Mentions only" for channels and "All messages" for DMs; mute and star are personal. Source: flow F09, D-046, D-103, D-143.
- A person is shown by initials on a colour, not a photo; People shows no email address. Source: D-118, prototype profile panel.
- Reconnect works from the last event number the client holds. Source: Toki Blueprint, technical design, API and realtime.
- Every route under `/api/v1` needs a valid session. Source: TOKI-022, BR-01.
- First load on 4G under 2 seconds, with 200 people. Source: NFR-13, D-113, NFR-04.
- Server modules call each other only through public interfaces, never each other's tables. Source: Toki Blueprint, boundary rules.
- Milestone: M2 "Sign-in, members and conversations". Size: M. Needs: TOKI-029, TOKI-030. Needed by: TOKI-032. Source: Toki Blueprint, ticket TOKI-031.

## Open questions
- Does the response carry unread counts, before messages and the read pointer exist?
- What is the event number before the events table exists?
- Which people come with it: only active ones, or deactivated ones too?
- Does an archived channel come with it?
- Which conversation settings come with it (level, mute, star), and as stored or as they apply?
- Which ticket makes a new DM appear in the other person's list only after the first message, and orders DMs by latest message?
