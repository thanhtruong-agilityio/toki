# Intent: Reactions
Author: Thanh Truong

## Problem
A person can send and read messages, but cannot answer one without writing another. A thumbs-up on "Dev server maintenance tonight" is a whole new message in the channel. The prototype has a short way to answer: press the smile button, pick one of eight emoji, and a small chip with a count appears under the message. Nothing of this exists on the server or in the app yet, and the message entry of the API has no place for it.

## Proposed outcome
A member of a conversation can react to a message with one of 8 fixed emoji (👍 ❤️ 🎉 😂 👀 🙏 ✅ 🚀) and take the reaction back. Each emoji in use shows under the message as a chip with its count; the chip is outlined when the signed-in person is one of those who reacted; pressing it adds or removes the person's own reaction. Pointing at a chip shows who reacted, and a long press does the same on a touch screen. Every member who has the conversation open sees a change at once, and a person who loads the history sees the reactions already there.

## Affected users and systems
- Members and Admins, who react and see reactions in channels, direct messages and groups.
- The server app (`apps/server`): a `reactions` module with the table, the two routes and the check of who may react; small additions to the event handler behind `recordChange` and to the message entry.
- The shared package (`packages/shared`): the list of the 8 emoji, the reaction part of the message entry, the schemas of the two requests and of the two event kinds, one error code.
- `client-core` (the answer to the two requests and the handlers that apply the two events), `ui-web` (the chip and the picker) and the web app (the wiring).
- Neighbouring work that this one gives something to: Activity items for reactions (TOKI-065), the Message component (TOKI-042), the action bar (TOKI-052), threads (TOKI-045), delete (TOKI-047) and the seed data (TOKI-081).

## Constraints
- The set is 8 fixed emoji and there is no full picker. Source: D-017, FR-35, AC-092.
- One reaction of each emoji per person per message; a person may hold several different emoji; a chip whose count reaches 0 disappears. Source: FR-35, AC-093, F15.
- The chip names the people who reacted; on touch screens a long press opens a small list of names and a short tap still adds or removes. Source: D-162, AC-094, D-067.
- Only a member of a conversation that is not archived may react; an archived channel refuses a reaction. Source: D-077, BR-11, TOKI-027 R5 and concern 3.
- While the connection is down a reaction is blocked with an explanation and never shown as added. Source: D-079, F16, TS-115.
- A reaction by another person gives the message's author one Activity item and no toast or push; the item is built by TOKI-065, and this work gives it the changes it reads. Source: FR-35, AC-095, D-163, D-174.
- Every text goes through i18n; the default language is English. Source: NFR-05.
- A person who is not a member of a private channel, direct message or group reads and sees nothing of it, so its reactions are not sent to them. Source: BR-09, BR-10, D-045, D-116.
- Milestone M3; size M. Needs TOKI-040 (and with it TOKI-037 and TOKI-038). Source: Toki Blueprint, ticket TOKI-046.

## Open questions
- Which request adds a reaction and which removes it, and does a repeat store a second one?
- Can a person react in a direct message that has become read-only because the other person was deactivated?
- In which order do the chips of one message stand?
- What does a message's reaction list show once the message is deleted, and who clears it?
- Who draws the row under a message and who draws the smile button?
