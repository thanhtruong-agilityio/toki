# Intent: Conversation tables
Author: Thanh Truong

## Problem
Toki is built around conversations: channels (public or private), direct messages and group direct messages.
The database has no table for them yet, and nothing records who belongs to a conversation.
Every rule that decides who may read or write a conversation depends on membership, so the tables have to exist before the channel and direct-message APIs, the bootstrap call and the messages table can be built.
Several rules are easy to break when only application code holds them: channel names must be unique even when two requests arrive together, a direct message between the same people must never exist twice, a group is limited to 8 people and never gains or loses people, and #general must stay a public, active channel.

## Proposed outcome
Two tables, `conversations` and `conversation_members`, exist in the database and are created by a migration.
A channel has a name, a topic, a description, a public or private flag and an archive time; a direct message or group direct message has no name and carries a key built from its members, so the same set of people always leads to the same conversation.
A membership row says that a person belongs to a conversation and holds that person's own notification level, mute and star.
The rules the database can hold itself (name format and uniqueness, topic length, one #general, one direct message per set of people with a sorted key and member rows that match it, a group of at most 8 whose people never change, kind and privacy fixed after creation, no deleting a conversation) are held by the tables. The rules that need a person's role or a count of members, such as who may create a channel, the archive when the last member leaves and refusing a guest in a direct message, stay with the requests of the later tickets.
Other modules read membership and the facts of a conversation through the functions of the module, not through its tables.
The later tickets that create, list and read conversations build on these tables instead of defining their own.

## Affected users and systems
- Members and Admins, who see the effects through the channel and direct-message tickets that build on this one: channels, DMs, group DMs, #general, notification level, mute and star.
- The server app (`apps/server`): a new `conversations` module with its table definitions, the function that builds a direct-message key and the reads of membership and conversation facts.
- The shared package (`packages/shared`): the limits for names, topics and groups and the notification levels, so the server and the web app use the same values.
- The database and its migrations (TOKI-005).
- The account tables (TOKI-019), which hold the people a membership points to.
- Later tickets that use the tables: the channel API (TOKI-029), the DM API (TOKI-030), the bootstrap call (TOKI-031), the messages table (TOKI-036), the first-Admin set-up (TOKI-020), accepting an invitation (TOKI-097) and the read pointer (TOKI-053).

## Constraints
- Channel names use lowercase letters, digits and hyphens, up to 80 characters, and are unique; uniqueness includes archived channels and holds when two requests arrive at the same moment. Source: Toki Blueprint, decisions D-040, D-115, D-128.
- Public or private is fixed at creation; there is no rename in phase 1. Source: D-040, D-105.
- Channels are archived, never deleted. Source: D-029.
- A topic is up to 250 characters; any member edits topic and description. Source: D-101, D-105.
- Every workspace has a #general channel created at set-up; it cannot be left or archived. Source: D-034.
- A group direct message holds up to 8 people counting its creator, and people cannot be added or removed. Source: D-045, D-086, rule BR-36.
- The same set of people always leads to the same conversation; messaging yourself is not supported in phase 1. Source: flow F25.
- Notification level defaults to "Mentions only" for channels and "All messages" for direct messages; mute and star are personal. Source: D-046, D-103, D-143.
- A person who has not joined a channel cannot read it, and writing needs membership. Source: D-116, D-077.
- When the last member leaves a private channel it is archived. Source: D-051.
- Every table carries `workspace_id` to keep a path to multi-tenant; IDs are UUIDv7. Source: Toki Blueprint, data model notes, D-004.
- Server modules call each other only through public interfaces, never each other's tables. Source: Toki Blueprint, boundary rules.
- Milestone: M2 "Sign-in, members and conversations". Size: M. Source: Toki Blueprint, ticket TOKI-028.
- Needs: TOKI-019 (Account tables). Needed by: TOKI-029, TOKI-030 and TOKI-036; the bootstrap call (TOKI-031) needs it through them. TOKI-020, TOKI-097 and TOKI-053 also write these tables and need it, which the plan does not yet say (spec, Plan changes). Source: Toki Blueprint, ticket list, Needs column.
- Belongs to Blueprint intent I05 channels-and-direct-messages.

## Open questions
- Is there a limit on the length of a channel description? The log gives a limit only for the topic.
- Does the rule "archived when the last member leaves" apply to public channels too, or only to private ones?
- When a person leaves a channel and comes back (Undo within 5 seconds, or being added again), do their notification level, mute and star come back?
- Which ticket builds the request that saves a person's notification level, mute and star?
- Which ticket adds the read pointer, which the Blueprint lists with these tables?
- How is a direct message or a group keyed so the same people never get two conversations?
