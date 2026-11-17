# Intent: Channel API
Author: Thanh Truong

## Problem
Channels are where Toki's work happens, and today nobody can create one, find one, join it, leave it or change it.
The tables for conversations exist (or are specified) and the permission rules exist as shared functions, but no request uses them.
Without this work the channel screens (Browse channels, the Details panel, adding and removing people, archive), the bootstrap call and every message request have no channels to work on.
Several rules must hold on the server whatever the screen shows: only an Admin creates a channel; two requests for one name end with one channel; a person who has not joined a channel cannot read it; a private channel is never revealed to an outsider; #general cannot be left or archived; only an Admin who is a member removes people or archives.

## Proposed outcome
The server answers requests to create a channel, browse channels, read a channel's details and member list, join, leave, edit the topic and description, add people, remove people, archive and restore.
Every request checks the permission functions of the shared package and refuses what the role or membership does not allow, in the same way for a private channel and for one that does not exist.
A channel name is never used twice, also when two requests arrive together and also for archived channels.
Joining gives a person the full history of the channel; leaving ends access; the last member leaving a private channel archives it.
A repeat of the same request, for example a double press of Create, changes nothing the second time.

## Affected users and systems
- Admins, who create, archive and restore channels and remove people from channels they belong to.
- Members, who browse, join, leave, edit the topic and description, and add people.
- The server app (`apps/server`): the `conversations` module gains the channel routes and the functions behind them.
- The shared package (`packages/shared`): the request and response shapes, and one more permission function for editing a channel's details.
- The screens that call these requests: Browse channels and the people picker (TOKI-034), the Details panel (TOKI-035), Create channel on the Admin page (TOKI-098), add and remove people (TOKI-100), archive and restore (TOKI-101); and the bootstrap call (TOKI-031), which reads channels.
- The direct-message request set (TOKI-030) shares the conversation tables but is a separate set of requests.

## Constraints
- Only an Admin creates channels; a Member's request is refused. Source: Toki Blueprint, D-084, D-090.
- Channel names: lowercase letters, digits and hyphens, up to 80 characters, unique, archived channels included, also for requests at the same moment; a second person is told the name exists. Source: D-040, D-115, D-128.
- Topic up to 250 characters; public or private fixed at creation; no rename in phase 1; any member edits topic and description. Source: D-101, D-040, D-105, D-041.
- A channel that is not joined cannot be read; there is no preview; joining gives the full history; channels are archived, never deleted. Source: D-116, D-029.
- Writing needs membership. Source: D-077.
- Any member adds people, in private channels too; only an Admin removes people, only in a channel they belong to, never from #general. Source: D-090, D-085, D-047.
- Only an Admin who is a member archives and restores, never #general. Source: D-047, D-034, F26.
- #general cannot be left or archived. Source: D-034.
- A private channel is rejoined only when a member adds the person back; leaving a public channel can be undone for 5 seconds; the last member leaving a private channel archives it. Source: D-051 (rejoin and last member), D-069 (Undo of a public leave), D-156 (no Undo for a private leave).
- A repeat of the same request is ignored. Source: D-111.
- Private channels never appear in Browse for outsiders; "no access" and "not found" are answered the same way. Source: D-051, BR-10.
- First 50 rows and more on scroll for lists. Source: D-109.
- Routes under `/api/v1`, one error format, permission checked on the server for every request. Source: D-125, BR-09.
- Milestone M2; size L. Needs TOKI-027 and TOKI-028. Source: Toki Blueprint, ticket TOKI-029.

## Open questions
- Does the rule "archived when the last member leaves" apply to public channels too?
- Who restores an archived channel in which no Admin is a member?
- Which channels does the Admin page's "Channels" list show: every channel, or only public ones and the private ones the Admin belongs to?
- Which ticket writes the system lines ("Lan added Minh"), the Activity items and the live events that a channel change causes?
- Which ticket builds the request that saves a person's notification level, mute and star for a channel?
- Is there a limit on the length of a channel description?
- Can a person who is deactivated be added to a channel?
