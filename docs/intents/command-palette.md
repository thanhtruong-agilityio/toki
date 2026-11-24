# Intent: Command palette
Author: Thanh Truong

## Problem
A person who works in Toki all day needs to reach a conversation, a person, a message or a setting without scrolling a list or opening three screens. The search request exists (or is specified) but nothing on screen calls it: there is no Ctrl+K, no Search field that does anything, and no quick action.
Without this work the Search field of the sidebar is not drawn, the More sheet of the phone has no Search row to open, and "Ctrl+K finds Vietnamese messages typed without diacritics" (the exit of milestone M4) cannot be shown.
The palette must never show what the person may not see, must work with the keyboard alone, and must work on a phone, where there is no keyboard shortcut.

## Proposed outcome
Pressing Ctrl+K (Cmd+K on a Mac), or pressing the Search field, opens a palette in the middle of the top of the screen. Before typing it shows recent conversations and quick actions. While typing it shows the results of the search request in groups, each with at most 20 results and a way to ask for more, together with the quick actions whose name matches. The arrow keys choose, Enter opens, Esc closes. Choosing a conversation opens it, a person opens their profile, a channel that could be joined opens Browse channels with its name, a message opens its conversation at that message, and an action runs.
On a narrow screen the palette opens from the search field at the top of Home and from the More sheet.
"Create channel" is offered to Admins only.

## Affected users and systems
- Every signed-in person, Members and Admins.
- The web app (`apps/web`): the palette, its keyboard handling, its entry points and its recent list.
- The client package (`packages/client-core`): the call of the search request and the state that debounces it and asks for more.
- The shared package: reads the schemas, limits and name functions of the search request (TOKI-070).
- The screens it opens or reuses: Browse channels and the people picker (TOKI-034), Create channel (TOKI-098), Set status (TOKI-056), the profile panel (TOKI-057), the More sheet (TOKI-092), jump to a message (TOKI-068).

## Constraints
- Ctrl+K searches conversations, people, commands, then messages; 20 results per group, more on request. Source: D-112, F29.
- Vietnamese matches when typed without diacritics; a person never sees a private channel, or a message from one, that they are not in. Source: D-015, D-051, D-116, AC-082, AC-083.
- Arrow keys choose, Enter opens, Esc closes; a modal traps focus and returns it; menus work with arrow keys. Source: F29, D-075.
- Messages are searched only in conversations the person belongs to, from 2 characters. Source: F29, D-116.
- "Create channel" is offered to Admins only; Members have no way to create a channel. Source: D-084, D-151.
- Narrow screens: opened from the search field on Home and from the More sheet; no feature is hover-only or desktop-only. Source: D-053, D-067, F29.
- An empty result says so, written for this context. Source: D-074, F29.
- When the connection is down every other action is blocked with an explanation, never a false success. Source: D-079.
- Every text in English and Vietnamese. Source: D-018, D-064.
- Milestone M4; size M. Needs TOKI-014 and TOKI-070. Source: Toki Blueprint, ticket TOKI-071.

## Open questions
- Which order do the names take after exact matches, and is there fuzzy matching? (The plan line says "exact, word-start, contains, then fuzzy"; D-187 is open and says no fuzzy matching in phase 1.)
- Which groups does the palette draw and in which order? (D-112 lists conversations, people, commands, messages; F29 adds "Channels you can join".)
- What are "recent conversations" before typing, and how many?
- What is "the search field at the top of Home" on a narrow screen, next to the list's own name filter?
- Which text of a person or conversation does a typed text match: the name only, or also a topic or a job title?
- How is a message result opened, and a reply in a thread?
- Where does a chosen person's profile open from the palette, which can be opened on any screen?
- What do "Pause notifications", "Start Focus time" and "Switch look" do from the palette (which duration, which look)?
- What does the palette do when the connection is down?
