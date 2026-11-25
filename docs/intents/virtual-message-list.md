# Intent: Virtualised message list
Author: Thanh Truong

## Problem
A conversation in Toki can hold thousands of messages, and the app must scroll through 10,000 of them at 60 frames per second (D-113). After the sync engine (TOKI-040) the client holds the messages of each conversation, but nothing draws them: the conversation page has a header and a Details panel and, in an archived channel, an empty place where its history belongs.
A chat list is not an ordinary list. It starts at the bottom, not the top. New messages must keep the person at the bottom when they are there and must not move them when they have scrolled up. Older messages load when the person nears the top, and the text they are reading must not jump when they arrive. A person with unread messages should land at the New divider (D-052), and a person who has scrolled up needs a button that brings them back to what is new.
Without this work the conversation shows no message, and the composer, the message component, threads, reactions, edits, pins and jumps to a message have no list to live in.

## Proposed outcome
The conversation page shows the messages of the conversation in a list that draws only the rows near the screen. It opens at the latest message, or at the New divider when the person has unread messages, or at a message it is asked to open at. It stays at the bottom while the person is there, holds the reading position when older messages load, loads older and newer messages as the person nears the ends, shows a floating button with the number of new messages when the person is scrolled up, and goes to the end after the person sends.
The same list draws the readable history of an archived channel in the place TOKI-101 left for it. The list also draws the day dividers, the New divider, the typing line under the last message and the row of tabs under the header, and it gives the message component a fixed contract so that the component can be built afterwards.
The choice of the virtualisation library, which the plan leaves open, is made and justified.

## Affected users and systems
- Every Member and Admin who reads a conversation, a channel, a direct message or a group, and every member who reads the history of an archived channel.
- The web app (`apps/web`): the conversation page (TOKI-033, TOKI-035), the archived channel page (TOKI-101), one new dependency and the texts of both languages in `packages/i18n`.
- The sync engine of TOKI-040, which this work reads and calls; the typing line of TOKI-044.
- The tickets that build on the list: the message component (TOKI-042), the composer (TOKI-043), threads, reactions, edit and delete, pins (TOKI-045 to TOKI-048), the read pointer and the New divider (TOKI-053, TOKI-054), jump to a message (TOKI-068), the extra states (TOKI-082) and the performance measurement (TOKI-089).

## Constraints
- Scrolling a channel of 10,000 messages runs at 60 frames per second, and switching to a channel opened before takes under 100 ms. Source: D-113, NFR-13.
- Initial JavaScript is under 200 KB compressed. Source: D-113, TOKI-007.
- Opening a conversation with unread messages scrolls to the New divider, which sits above the first unread message. Source: D-052, F09, AC-022.
- Scrolling to the top loads older messages and the reading position does not jump; while scrolled up, new messages show a floating button with their number; pressing it goes to the bottom. Source: journey F09.
- The message list has day dividers, and consecutive messages from one person within 5 minutes are grouped. Source: journey F09, D-091.
- An archived channel is readable, and its composer is replaced by a notice. Source: D-029, F10, F26, AC-052.
- A person who is not a member reads nothing of a conversation. Source: D-116, BR-09.
- Loaded conversations can be read and scrolled while offline. Source: AC-071, TS-112.
- Every text goes through i18n; English is the default; the app runs in the last two versions of Chrome, Edge, Safari and Firefox. Source: NFR-05, NFR-14.
- Milestone M3, size L. Needs TOKI-040 and TOKI-101. Source: Toki Blueprint, ticket TOKI-041.

## Open questions
- Which virtualisation library does the list use?
- What does the list show while the first page loads, and when it fails?
- Which ticket decides which message is the first unread and when the New divider clears, and which draws it?
- Which ticket draws the day dividers and decides the grouping, the list or the message component?
- Does the "new messages" button count system lines and the person's own messages?
- Is the scroll position of a conversation remembered when the person switches away and back?
- How does a person who opened at the New divider, or at a jumped-to message, get back to the latest message when the list does not hold it yet?
