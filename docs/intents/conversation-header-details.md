# Intent: Conversation header and Details panel

Author: Thanh Truong

## Problem

A person who opens a channel, a direct message or a group has no way yet to see what it is or to set it up for themselves. The conversation list is built, but the conversation itself shows no name, no topic and no head count, and there is nowhere to read who is in the channel, to change how Toki notifies them about it, to star it, to correct its topic, or to leave it. Leaving a channel is also the one action in phase 1 where a wrong build is costly: a public channel can be left at once and brought back, but a private channel can be rejoined only when a member invites the person again.

## Proposed outcome

- The top of an open conversation shows its name, its topic when it has one, a star when the person starred it, and the number of people in it. A button there opens the Details panel; on a narrow screen the same top row has a Back button to the list.
- The Details panel shows the conversation's name, topic, description, creator and creation date, and the people in it. Any member of a channel edits its topic and description in place; the name cannot be changed.
- The panel lets the person choose a notification level (All messages, Mentions only, Nothing), mute the conversation and star it. These settings belong to the person alone. A new channel starts at Mentions only and a new direct message at All messages.
- A member leaves a channel from the panel. Leaving a public channel happens at once and offers Undo for 5 seconds. Leaving a private channel asks for a confirmation that says a member must invite the person back, and offers no Undo. The last member of a private channel is told it will be archived. #general has no Leave.
- Browser Back closes an open Details panel before it leaves the conversation.

## Affected users and systems

- Users: Members and Admins of the workspace. Source: Toki Blueprint, requirements FR-05, FR-16, FR-21, FR-48.
- Systems: the web app (`apps/web`) and the channel requests of the server that it calls (TOKI-029). Source: Toki Blueprint, ticket TOKI-035.

## Constraints

- The default notification level is Mentions only for channels and All messages for direct messages. Source: Toki Blueprint, decision D-046.
- The level Nothing only stops toast, push and sound; Mute also hides the unread badge and bold. Source: D-103.
- Notification level, mute and star are personal: nobody else sees them. Source: D-143.
- Any member edits the topic and description in place; a channel cannot be renamed in phase 1. Source: D-105.
- Leaving a public channel happens at once with Undo for 5 seconds; leaving a private channel asks for confirmation that says a member must invite the person back, with no Undo; an action never has both. Source: D-051, D-061, D-069, D-156.
- When the last member leaves a channel it is archived; the last member is told. Source: D-051, journey F23.
- #general cannot be left. Source: D-034.
- Browser Back closes an open side panel first, then returns to the previous place. Source: D-089.
- No feature is hover-only or desktop-only; every action has an entry point on narrow and touch screens. Source: D-067.
- The pattern for the two kinds of leave is the one built by TOKI-093, and dates and times are written by the module of TOKI-094. Source: Toki Blueprint, ticket TOKI-035, needs.
- Every text goes through i18n; English is the default language. Source: Toki Blueprint, technical design and decision D-139 (wording the prototype does not contain is a proposal).
- A member list shows the first 50 people and loads more on scroll. Source: D-109.
- Size: M. Source: Toki Blueprint, ticket TOKI-035.
- Needs: TOKI-033, TOKI-093, TOKI-094. Source: Toki Blueprint, ticket list, Needs column.
- Belongs to Blueprint intent I05 channels-and-direct-messages, milestone M2. Source: Toki Blueprint, intent list.

## Open questions

- Which ticket builds the request that saves a person's notification level, mute and star? The channel API (TOKI-029) and the bootstrap endpoint (TOKI-031) both leave it to no one.
- What does the last member of a public channel see when leaving? AC-056 says the channel is archived whoever leaves last, journey F23 gives the warning for a private channel only.
- Which changes does an archived channel refuse in its Details panel?
