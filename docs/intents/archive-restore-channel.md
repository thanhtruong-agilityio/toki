# Intent: Archive and restore a channel (screens)
Author: Thanh Truong

## Problem
A channel that is no longer used must be put away without losing what was said in it. The decision log says channels are archived and never deleted (D-029). The server already has the two requests (TOKI-029: archive and restore, Admin only, only where the Admin is a member, never #general), the client already has the two commands (TOKI-032), but no screen uses them. An Admin has no button to archive a channel, no way to restore one, and nothing shows a member what an archived channel is.
Four things are easy to get wrong. Archiving asks other people's list to lose a channel, so it needs a confirmation that names the channel and its member count (D-061, D-069, F26). Once archived, the channel leaves everyone's list, its composer is replaced by a notice and its history stays readable (F10, F26, D-029), but the conversation list and the first load leave archived channels out (TOKI-031), so a member who opens one from Browse channels has no list entry to open. Browse channels must show the channel with an "Archived" label and give Admins a "Restore" button (F26), while the capability table says an Admin archives and restores only where they are a member (D-090, D-047). And nothing may delete a channel (AC-052).

Source: Toki Blueprint, ticket TOKI-101; decisions D-029, D-034, D-047, D-061, D-069, D-090, D-185 (open); flows F10, F21, F26; requirements FR-20, FR-29 (AC-052, AC-077, AC-078); business rules BR-07, BR-20.

## Proposed outcome
- An Admin who is a member of a channel other than #general finds an "Archive channel" button, in the place that D-185 settles (the channel's Details panel is the working proposal; open question 3). Pressing it asks for confirmation; the question names the channel and its member count. Confirming archives the channel. A Member, and an Admin who is not a member, have no such button, and nobody has one for #general.
- An archived channel is opened by a member from Browse channels. It shows the channel's name, its topic and an "Archived" label, the history stays readable, and in the place of the composer a notice reads that the channel has been archived. Nobody can post in it.
- Browse channels shows an archived channel with its "Archived" label and, for an Admin who is a member of it, a "Restore" button. Pressing it puts the channel back in the list of its members; whether it first asks for a confirmation is an open question (question 2).
- There is no control anywhere that deletes a channel.
- The build adds no decision of its own about who may restore a channel that has no Admin among its members; that question stays with the product owner.

## Affected users and systems
- Admin (archives and restores), Member (opens and reads an archived channel; never sees the Admin controls).
- `apps/web`: a new folder for the archive and restore screens, the Details panel (TOKI-035), the Browse channels rows (TOKI-034) and the conversation route (TOKI-033), each with one small addition. `packages/i18n`: one namespace. The action list of TOKI-093 gets one row. `packages/ui-web` is not touched.
- Depends on TOKI-093 (confirmation and Undo patterns) and reads the specs of TOKI-029 (the two requests), TOKI-032 (the commands), TOKI-033, TOKI-034 and TOKI-035 (the screens it extends).

## Constraints
- Archive is offered only to an Admin who is a member of the channel, never for #general. Source: D-047, D-034, D-090, F26, AC-016.
- The confirmation names the channel and its member count; an action never has both a confirmation and an Undo. Source: F26, D-061, D-069, AC-077, AC-078.
- After archiving, the channel leaves everyone's list, its composer is replaced by "This channel has been archived", and its history stays readable. Source: F10, F26, D-029, AC-052.
- A channel is archived, never deleted: no control deletes it. Source: D-029, AC-052.
- Browse channels shows the "Archived" label and gives Admins a "Restore" button. Source: F26, F21.
- When the connection is down the actions are blocked with an explanation; a button is disabled while its request runs. Source: D-079, D-111.
- No feature is hover-only or desktop-only; every control is at least 40 px tall at 719 px and below. Source: D-067, NFR-02.
- English is the default language and every text goes through i18n; Vietnamese is complete. Source: D-018, D-064.
- Every wording in quotes that the prototype does not contain is a proposal. The prototype has no archive, no restore and no archived channel. Source: D-139.
- Permissions are checked on the server; the screen only does not offer what the server would refuse. Source: BR-09, D-090.

## Open questions
- Who restores an archived channel in which no Admin is a member? The capability table says an Admin restores only where a member; F26 gives Admins a "Restore" button in Browse channels; D-184 is open.
- Does Restore ask for confirmation, offer Undo, or neither? D-061 names the pattern of Archive only.
- Where does "Archive channel" open from? D-185 is open and proposes the Details panel.
- What does a member see and reach when they open an archived channel (header, Details panel, how they get there)? The list and the first load leave archived channels out.
- What do other members see when a channel they have open is archived? F26 says a strip, "This channel was just archived"; no ticket owns live updates yet.
- Which member count does the confirmation show, and does it include deactivated people?
