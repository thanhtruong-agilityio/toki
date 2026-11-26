# Intent: People screen

Author: Thanh Truong

## Problem
A person who wants to find a colleague, see who is around or start a conversation has no place to look. The navigation has no People item, there is no list of everyone in the workspace, and the profile panel (TOKI-057) can only be opened from a message, a member row or the Details panel of a conversation the person already belongs to. A person who has not yet talked to someone cannot reach that person's profile, and so cannot send them a first direct message from it.

## Proposed outcome
- A People page at its own address, reached from the People item of the navigation and, on a narrow screen, from the More sheet.
- The page lists the active Members and Admins of the workspace as cards, the person's own card included. A card shows initials on a colour (no picture), the presence dot and word, the name, an "Admin" label where it applies (no "Owner"), the job title and the person's local time.
- A search field above the list keeps the people whose name or job title contains the typed text. With no match the page says "Nobody matches".
- The first 50 people are shown and more appear as the person scrolls.
- A deactivated person has no card.
- Pressing a card opens that person's Profile panel at an address of its own; Back closes the panel first and then returns to the previous place.

## Affected users and systems
- Every Member and Admin. Source: Toki Blueprint, ticket TOKI-079, FR-42.
- The web app (`apps/web`): a page, two routes, a section row, a few texts. Nothing on the server and no new request: the page reads the people the app already holds.
- `packages/i18n`: a small `people` namespace in English and Vietnamese.
- Read as they are: presence (TOKI-055), status (TOKI-056), the date and time rules (TOKI-094), the profile panel (TOKI-057), the people held by the client store (TOKI-031, TOKI-032, TOKI-033), the section frame of the app shell (TOKI-015) and the list hook of Browse channels (TOKI-034).

## Constraints
- Initials on a colour; no profile picture in phase 1. Source: D-118.
- There is no Owner role: an Admin card carries "Admin" and no card carries "Owner". Source: D-152, FR-42, AC-116.
- Local time comes from the time zone the person set, not from where they are now, in 24 hours. Source: D-144, D-123.
- The search keeps the people whose name or job title contains the text; the first 50 people are shown and more load on scroll. Source: D-109, FR-42, AC-117, AC-118.
- A deactivated person is not listed. Source: F41, AC-116.
- An empty search result has an empty state centred in the content area, written for the search. Source: D-074.
- Pressing a card opens the Profile panel; the page has an address and Back closes the panel first. Source: FR-42, AC-119, D-089.
- Every control is usable on a phone with no hover. Source: D-053, D-067.
- Every text goes through the translation files, in English and Vietnamese; a wording the prototype does not contain is a proposal. Source: NFR-05, D-018, D-139.
- Milestone M6, size S. Needs TOKI-055, TOKI-056 and TOKI-094. Source: Toki Blueprint, ticket TOKI-079.

## Open questions
- Does the search match Vietnamese typed without diacritics, and in what order are the cards listed?
- What does a card show for a person who has not set a time zone?
- Where do the job title and the time zone come from, since the people the app holds carry neither today?
- Does the card show the person's status or a city?
- What address does the profile panel have on this page?
