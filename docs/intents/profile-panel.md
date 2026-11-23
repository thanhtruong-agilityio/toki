# Intent: Profile panel

Author: Thanh Truong

## Problem

A person sees a name on a message, a row in the member list or the other person of a direct message, and has no way to learn who that is. The conversation list, the message component and the Details panel already draw names and initials, but nothing opens a profile: the member rows of the Details panel are not pressable, a name on a message is plain text, and the Details panel of a direct message shows one bare row where the person's profile belongs. The facts that make a colleague a person (job title, whether they are at their screen, their status, what time it is for them) are shown nowhere.
There is also no way to start a direct message from the person, and no screen for a person's own profile that leads to Set status and to changing their details.

## Proposed outcome

A Profile panel opens on the right when a person presses a name, an avatar or a member row. Afterwards:

- The panel shows the person's initials on a colour (no picture), name, job title, presence in words, status when there is one, local time computed from the time zone the person set, and that time zone as a UTC offset.
- Another person's profile has a Message button that opens the direct message with them. A deactivated person's profile is labelled "Deactivated" and has no Message button.
- A person's own profile has "Set status" and "Edit profile" and no Message button.
- The Details panel of a direct message shows the other person's profile where a channel shows its members, and the rows of a member list open the profile.
- Back (the browser's, the panel's own and Escape) closes the profile panel first, then returns to the previous place.

## Affected users and systems

- Members and Admins, who open profiles and start direct messages from them. Source: Toki Blueprint, flow F31, FR-42.
- The web app (`apps/web`): the conversation page, the Details panel, the message component and the conversation header. Source: Toki Blueprint, ticket TOKI-057 and the merged specs of TOKI-035 and TOKI-042.
- Later screens that open the same panel: People (TOKI-079) and the command palette (TOKI-071). Source: Toki Blueprint, flows F31 and F29.
- Deactivated people, whose old messages and rows stay and are labelled. Source: Toki Blueprint, flows F31 and F41.

## Constraints

- Part of milestone M4 (messages, presence and files). Size S. Needs TOKI-055 and TOKI-094. Source: Toki Blueprint, ticket TOKI-057.
- An initials avatar on a colour; no picture upload in phase 1. Source: Toki Blueprint, D-118.
- The local time on a profile comes from the time zone the person set, not from where they are now, and is shown with a UTC offset. Source: Toki Blueprint, D-144 and the plan line of TOKI-057.
- Time is shown in 24 hours for every person and every language. Source: Toki Blueprint, D-123.
- A deactivated person is labelled "Deactivated" and has no Message button; their old messages stay. Source: Toki Blueprint, flows F31 and F41.
- A person's own profile has Set status and Edit profile and no Message button. Source: Toki Blueprint, flow F31, FR-42 (TS-190).
- No screen sets presence by hand. Source: Toki Blueprint, D-121 and FR-45 (TS-206).
- Back closes the side panel first, then returns to the previous place; from 720 px to 1099 px a profile overlays the chat, from 1100 px it is a column, under 720 px it is the whole screen. Source: Toki Blueprint, D-089 and D-068.
- Actions that write are blocked with an explanation while the connection is down. Source: Toki Blueprint, D-079.
- Every wording that the prototype does not contain is a proposal and every text goes through `@toki/i18n`; English is the default language. Source: Toki Blueprint, D-139 and D-018.
- Others' email addresses are not shown. Source: spec of TOKI-031 (Decided in that spec).
- The columns of job title, time zone and status text are added by their own tickets. Source: merged spec of TOKI-019 (`account-tables`, concern 8) and of TOKI-031 (R12).

## Open questions

- Does the Time zone row show the UTC offset, a city, or both? Source: D-144 reads "Profile: local time and a city"; the plan line and flow F31 say "a UTC offset"; the prototype shows a city name; Preferences has no field for a city.
- What does a profile show for a person who has not set a time zone? Source: no decision gives a default time zone; D-144 covers only a zone that was set.
- What does the profile of a deactivated person show besides the label (presence, status, local time)? Source: flows F31 and F41 give the label and the missing Message button and say nothing else.
- Where does "Edit profile" lead? Source: flow F31 names the button; the Preferences flow lists display name, job title and time zone as the profile fields.
- Which ticket adds the job title, time zone and status text of a person and delivers them to the screen? Source: the bootstrap call carries none of them (TOKI-031 R12); the accounts spec says a separate server ticket adds the columns; the plan has no such ticket.
