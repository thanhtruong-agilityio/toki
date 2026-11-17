# Intent: Browse channels and the people picker
Author: Thanh Truong

## Problem
A person who joins a workspace sees only the channels they belong to and has no way to find the others, and no way to start a conversation with one other person or with a few. The conversation list (TOKI-033) draws a "Browse channels" row and a "+" on "Direct messages", the channel and direct-conversation requests exist on the server (TOKI-029, TOKI-030), and the overlay components exist (TOKI-014), but nothing yet draws what those two controls open.
Two rules make these screens easy to get wrong. A channel that a person has not joined cannot be read at all, not even as a preview, and that must hold in the dialog and when the person arrives by a link (D-116). A group conversation holds 8 people counting its creator, nobody is added afterwards, and the same set of people always leads to the same conversation (D-017, D-045, D-086), so the screen must say no to a ninth person before it asks the server. The prototype draws neither screen as the log decides: its Browse list has no archived label and no paging, and its "New message" dialog opens a conversation on the first press and has no chips.

Source: Toki Blueprint, ticket TOKI-034; decisions D-017, D-074, D-084, D-086, D-109, D-116; flows F21, F25; requirements FR-20, FR-22, FR-30.

## Proposed outcome
A person can press "Browse channels" and see every public channel, and the private channels they are in, with its name, topic and member count. They can search, scroll for more beyond the first 50, press "Join" on a channel they are not in or "Open" on one they are in, and see an "Archived" label on a channel that is archived. A search with no result says so, centred in the list. Nothing in the dialog creates a channel.
A person who opens the address of a public channel they have not joined sees its name and topic and a "Join" button, and no message.
A person can press the "+" on "Direct messages", search the people of the workspace (the first 50, more on scroll), press a person to add a chip with their name, remove a chip, and press "Start": one chip opens the direct message with that person, two to seven chips open a group. A person beyond the 8th, counting the person who starts, is refused with a message. Closing the picker with people chosen asks whether to discard.
Both dialogs work with a keyboard and a touch screen and show correctly from 360 x 560 upwards, in English and in Vietnamese.

## Affected users and systems
- Members and Admins, who browse channels, join them and start direct messages and groups. Source: Toki Blueprint, flows F21, F25.
- `apps/web` (the two dialogs, the view of a channel not joined, their texts) and `packages/ui-web` (one chip for a chosen person); `packages/i18n` (two namespaces).
- The conversation list (TOKI-033), which holds the two controls and opens the dialogs; the client-core store and API client (TOKI-032), which these screens read and write through. Source: Toki Blueprint, Needs column.

## Constraints
- Work area Channels and DMs, milestone M2, size M. Needs TOKI-014, TOKI-032 and TOKI-093; the channel API (TOKI-029) and the direct-conversation API (TOKI-030) are the requests it calls. Source: Toki Blueprint, ticket TOKI-034.
- Browse channels lists name, topic and member count, offers "Join" or "Open", labels an archived channel, shows the first 50 and loads more on scroll. Source: D-109, flow F21, requirement FR-20.
- A search that matches nothing shows a message written for that list, centred in the content area. Source: D-074, requirement AC-079.
- A channel that is not joined shows no message, in the dialog or from a link, only its name and topic with "Join". Source: D-116, requirement AC-053.
- No button creates a channel in Browse channels. Source: D-084, business rule BR-37.
- The picker is opened by the "+" on "Direct messages"; each person pressed becomes a removable chip; "Start" opens the direct message for one chip and a group for more; a person beyond 8, counting yourself, is refused. Source: D-086, D-017, D-045, D-155, flow F25, requirement FR-22.
- The same set of people always leads to the same conversation; messaging yourself is not supported; a deactivated person is not listed. Source: flow F25, F41.
- A form with content does not close on an outside click; closing it by its button asks whether to discard. Source: D-070, requirement FR-28; the guard is TOKI-093's.
- No feature is hover-only; a modal traps focus and returns it to the opening button. Smallest size 360 x 560. Source: D-067, D-075, D-068, requirement NFR-01, NFR-03.
- English is the default language and every text is translated. Source: D-018, D-064.
- A button is disabled while its request runs; while the connection is down every write other than a message is blocked with an explanation; server statuses map to screen behaviour as D-131 says. Source: D-111, D-079, D-131.
- Permission is checked on the server; the screens show what the server answers. Source: business rule BR-09.
- Looks come from the prototype; where it draws nothing, Claude decides. Source: D-019, D-139.
- Written at the same time as TOKI-032 (client-core), TOKI-033 (conversation list) and TOKI-035 (header and Details panel).

## Open questions
- Where does the colour of a person's avatar come from? The picker draws avatars and needs the number.
- Do Browse channels and the people picker rise from the bottom on a phone, or stay centred dialogs?
- Does the text typed in the people search count as content for the discard question, or only the chosen people?
- Who opens a channel that is archived and not in the person's list, which Browse offers to its members as "Open"?
- Who draws the "Restore" button that Admins have beside an archived channel in Browse channels?
