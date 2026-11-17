# Intent: Create a channel from the Admin page

Author: Thanh Truong

## Problem

Only an Admin creates channels, and the prototype has no screen for it: its Browse channels dialog has no way to create one, and the Admin page it draws has no "+" for channels. The server will accept a create request (TOKI-029) and the client store has a command for it (TOKI-032), but nothing in the web app lets an Admin type a name and press Create. Until this exists, the channels of a workspace can only be the ones that were put there by a script.

Four rules make this dialog easy to get wrong. A channel name is lowercase letters, digits and hyphens up to 80 characters, and a space typed in it must become a hyphen instead of an error (D-040, D-127). Two Admins can send the same name at the same moment, and the one who loses must be told under the field (D-115). A press that is repeated, or a retry after no answer, must never make two channels (D-111). A Member must have no way to reach the dialog (D-084). The client also has to make the channel's id itself, as a UUIDv7, because the server expects it (TOKI-029); no ticket has built that generator yet.

Source: Toki Blueprint, ticket TOKI-098; decisions D-040, D-070, D-076, D-084, D-101, D-104, D-111, D-115, D-127, D-128, D-151, D-183; flow F20; requirements FR-19, FR-28, AC-047 to AC-049.

## Proposed outcome

- An Admin sees a "+" beside the "Channels" list of the Admin page. Pressing it opens the Create channel dialog with four fields: Name, a Private switch (off by default), Topic (optional, up to 250 characters) and Add people (optional).
- A space typed in the name becomes a hyphen and a capital letter becomes lowercase. A name that is still not valid shows its message under the field, and Create stays disabled until the form is valid and while the request runs.
- A name that is already used, by a public or private channel, archived or not, is refused by the server and the Name field says so.
- Pressing Create makes the channel. The Admin and the chosen people are its members, and the new channel opens at once.
- Closing the dialog with something typed asks whether to discard; an outside click does nothing.
- A Member has no control that opens the dialog, and the server refuses a Member's request.
- The client can make UUIDv7 ids, in one place that message sending will also use.

## Affected users and systems

- Admins, who create channels. Members, who must have no way to do it. Source: Toki Blueprint, flow F20, D-084.
- `apps/web` (the dialog, its button, its texts), `packages/shared` (the UUIDv7 generator), `packages/i18n` (one namespace). Source: Toki Blueprint, ticket TOKI-098; TOKI-032 concern 11.
- The Admin page (TOKI-025), which holds the Channels list and places the button; the channel API (TOKI-029); the client store (TOKI-032); the people picker (TOKI-034); the discard guard (TOKI-093).

## Constraints

- Work area Channels and DMs, milestone M2, size M. Needs TOKI-093; the plan lists nothing else, and the spec lists the real needs. Source: Toki Blueprint, ticket TOKI-098.
- The fields are Name, a Private switch off by default, Topic (optional, up to 250 characters) and Add people (optional); the dialog is opened by an Admin from the Admin page. Source: D-101, D-151.
- A name uses lowercase letters, digits and hyphens, up to 80 characters; public or private is fixed at creation; a name is unique, archived channels included. Source: D-040, D-128.
- A space typed in the name becomes a hyphen and capitals become lowercase. Source: D-127.
- Errors show under the field; Create is disabled until the form is valid and while the request runs. Source: D-104, D-111.
- A name already in use is refused by the server and the field says so, also when two Admins submit at the same moment. Source: D-115, AC-049.
- Closing with content asks whether to discard; an outside click does nothing. Source: D-070, FR-28; the guard is TOKI-093's.
- After something is created the screen shows it. Source: D-076, F20.
- A Member has no way to open the dialog. Source: D-084, AC-048.
- While the connection is down, admin actions are blocked with an explanation. Source: D-060, D-079.
- Statuses map to screens as D-131 says; a request with no answer after 10 seconds counts as failed. Source: D-131, D-126.
- No feature is hover-only; modals trap focus and return it; smallest size 360 x 560. Source: D-067, D-068, NFR-01 to NFR-03.
- English is the default language and every text is translated. Source: D-018, D-064.
- Looks come from the prototype; where it draws nothing, Claude decides. Source: D-019, D-139.
- Written at the same time as TOKI-025 (Admin page), TOKI-099, TOKI-100 and TOKI-101.

## Open questions

- Does Esc, or a changed Private switch alone, count when the dialog asks whether to discard?
- Does the dialog rise from the bottom on a phone, or stay a centred dialog?
- Who makes the conversation list show the new channel when its filter would hide it (D-076)?
- Who draws the "+" and who owns the dialog, TOKI-025 or TOKI-098?
