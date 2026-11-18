# Intent: Add and remove people in a channel (screens)
Author: Thanh Truong

## Problem
A channel changes as people join the work and leave it. Today the server has the routes that add people to a channel and remove a person from it (TOKI-029), and the Details panel lists the members (TOKI-035), but no screen lets anyone use the two routes. The rules are decided: any member can add people, in a private channel too; only an Admin who is a member of the channel can remove a person, never from #general; the person to add is chosen from people not yet in the channel; removing someone asks for a confirmation that names the person.
The prototype draws none of this: its Details panel lists members and has no control to add or remove one. The pieces exist as parts: the people picker and its chip (TOKI-034), the confirmation and the discard guard (TOKI-093), the member list (TOKI-035). Nothing yet joins them into the two actions.

Source: Toki Blueprint, ticket TOKI-100; decisions D-085, D-047, D-069, D-090, D-109; journey F22; requirements FR-23 (AC-060, AC-061), FR-28, FR-29.

## Proposed outcome
In the Details panel of a channel, under Members, every member of the channel sees an "Add people" control. It opens a dialog with a search that lists only people who are not yet in the channel, the first 50 shown and more on scroll. The person chooses one or more, presses "Add", and the members list shows them.
An Admin who is a member of the channel also sees a "Remove" control on each member row, except in #general and except on their own row. Pressing it asks for a confirmation that names the person; confirming removes the person and the list shows it. A Member never sees "Remove". A direct message and a group have neither control. An archived channel has neither control.
Both actions are blocked with an explanation while the connection is down. The texts exist in English and Vietnamese.

## Affected users and systems
- Every Member and Admin who belongs to a channel (add), and every Admin who belongs to a channel (remove). Source: Toki Blueprint, capability table, rows "add people to a channel you are in" and "remove people from a channel".
- `apps/web` (the Details panel's Members section, a dialog, a confirmation), `packages/i18n` (a new namespace). It reuses the picker of TOKI-034, the patterns of TOKI-093 and the member list of TOKI-035, and calls the two routes of TOKI-029.

## Constraints
- Needs: TOKI-093. It also reads the channel routes (TOKI-029), the store and client (TOKI-032), the picker (TOKI-034) and the panel (TOKI-035). Source: Toki Blueprint, ticket Needs column and the specs of those tickets.
- Any member can add people, in private channels too; the list offers only people not yet in the channel; first 50 shown, more on scroll. Source: D-090, D-109, F22.
- Only an Admin who is a member of the channel removes a person, never from #general; a Member has no control and the server refuses. Source: D-085, D-047, BR-38, AC-060, AC-061, TS-094.
- Removing a person affects another person, so it asks for a confirmation that names the person and has no Undo. Source: D-069, FR-29, AC-077, AC-078.
- A dialog with content does not close on an outside click; closing it by a button asks whether to discard. Source: D-070, FR-28.
- A button is disabled while its request runs and the server ignores a repeat; every action other than a waiting message is blocked offline with an explanation. Source: D-111, D-079.
- A group DM has no way to add or remove a person. Source: AC-058, BR-36.
- No feature is hover-only; every control is at least 40 px tall at 719 px and below. Source: D-067, journey F38.
- English is the default language and every text goes through i18n; Vietnamese is complete. Every wording in quotes that the prototype does not contain is a proposal. Source: D-018, D-064, D-139.

## Open questions
- Does the person who is removed, or the person who is added, get a notice, an Activity item or a system line in the channel? F22 names a system line and an Activity item for an add; the log says nothing for a removal.
- A person removed from a public channel can join it again from Browse channels. Does a removal have to stop that?
- Which ticket draws the two controls inside the Details panel: TOKI-035 or this one?
- Is "Add people" offered in #general, where every active person is already a member?
- What is the wording of the dialog, the confirmation and the error lines, in English and in Vietnamese?
