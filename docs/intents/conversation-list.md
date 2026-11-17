# Intent: Conversation list

Author: Thanh Truong

## Problem

A signed-in person needs to see every conversation they take part in and move between them. After TOKI-015 the app has a frame with a place for the list and after TOKI-032 it holds the person's conversations in a store, but nothing draws them. Without the list a person cannot see which channels, direct messages and groups they have, which ones have something new, or open one; the app has no address for a conversation either, so a link, a reload and the browser's Back button have nothing to work with.

On a narrow screen the list is the Home screen itself, and the prototype's list breaks two rules that the decision log now sets: the Direct messages heading has no way to start a conversation (the prototype uses a pencil icon, which D-155 removes, and a modal that opens a chat on the first press), and the '+' that D-086 and D-154 put on that heading must show on hover on a desktop and always on touch screens.

## Proposed outcome

- The sidebar shows the person's conversations in three collapsible groups, Starred, Channels and Direct messages; an empty group is not shown.
- Each row shows what kind of conversation it is, its name, and when there is something to show, an unread count, an @ mark for a mention and a muted look; a row opens its conversation.
- The person filters the list with All, Unread and Mentions and by a search on the name; a filter that matches nothing says so in the middle of the list and offers a way back.
- The Direct messages heading has a '+' that starts a direct message or a group (shown on hover on a desktop, always on touch and narrow screens). A '+ Browse channels' row at the end of the list and a button at the top open Browse channels. Nothing in the list creates a channel.
- Every conversation has its own address; the app opens on the conversation last viewed on the device, the first time on #general; on a narrow screen Home is the list.
- The groups that are collapsed and the filter that is chosen are remembered on the device.
- The list works in both looks, in both languages and at every width from 360 px.

## Affected users and systems

- Users: every Member and Admin, on the web in phase 1. Source: Toki Blueprint, flows F08, F09 and F38.
- Systems: `packages/ui-web` (the list as a presentational component), `apps/web` (the wiring to the store of TOKI-032, to the router and to the device's storage) and `packages/i18n` (a new namespace). No server change.

## Constraints

- Scope given by the Blueprint: Starred, Channels and Direct messages groups; collapse; All, Unread and Mentions filters; search by name. Source: Toki Blueprint, ticket TOKI-033.
- The Direct messages heading has a '+' that starts a DM or a group, on hover on a desktop, always visible on touch and narrow screens; there is no pencil icon. Source: D-086, D-154, D-155.
- A '+ Browse channels' row closes the list; nothing in the list creates a channel. Source: D-084.
- A filter that matches nothing shows its own empty state, centred in the content area. Source: D-074.
- Each conversation has its own address, and Back closes an open panel first. Source: D-089.
- The app opens on the conversation last viewed on the device; the first time, on #general. Source: D-035, BR-08.
- Star and Mute are personal; starred conversations sort to the top of the person's list. Source: D-143.
- A muted conversation shows no count and no bold; it keeps the @ mark while the person's switch for mentions in muted conversations is on. Source: D-103, D-088.
- Order within a group: channels alphabetically, direct messages by most recent message; collapsed groups and the filter are remembered per device. Source: flow F09, accepted in D-091.
- No feature is hover-only or desktop-only, every control is at least 40 px tall on a narrow screen, every icon-only button has a name. Source: D-067, D-075, flow F38.
- The conversation list is always the main area of the sidebar; smallest size 360 x 560; under 720 px one pane at a time. Source: D-068.
- Both looks, English by default and full Vietnamese, every text through i18n. Source: D-018, D-064.
- A conversation that is not joined cannot be read; an archived channel leaves everyone's list. Source: D-116, D-029.
- All conversations are in the first load in phase 1. Source: D-117.
- Milestone: M2. Size: M. Needs: TOKI-015 and TOKI-032. Needed by: TOKI-035. Source: Toki Blueprint, ticket TOKI-033.
- Belongs to Blueprint intent I05 channels-and-direct-messages. Source: Toki Blueprint, intent list.

## Open questions

- The prototype hides the conversation search field in the Calm look and shows it in Focus and on a narrow screen; flow F09 says the field filters by name without naming a look. Which is wanted?
- Flow F09 says an empty group is not shown, but a person with no direct message would then have no '+' to start one. Is the Direct messages heading kept when it is empty?
- Which ticket hides a new direct message from the other person until its first message (F25)?
- Where do the Unread and Mentions filters get their data before the read pointer exists, and which of TOKI-033 and TOKI-054 owns them?
- Does a row of the Starred group carry a star glyph (the note of D-143), or is the group heading enough?
- Does the search on the name ignore Vietnamese diacritics, as the command palette does (D-015)?
- What is the head count under the workspace name, and does it count deactivated people?
- Where does a person's avatar colour come from?
- Does a direct message with a deactivated person show the 'Deactivated' label in the list?
- Which ticket opens the app on the last viewed conversation and falls back to #general?
