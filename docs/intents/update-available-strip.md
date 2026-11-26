# Intent: Update-available strip
Author: Thanh Truong

## Problem
Toki is deployed by replacing the server and the web files together. A person who keeps the app open all day, or who installed it as a window of its own, keeps running the old page after a deploy. Most of the time that is harmless, but two things go wrong: the old page cannot know a better one exists, and a page that is too old for the server can send requests the server no longer understands or ask for web files that the new release no longer holds.
Nothing in the app tells the person to reload, and nothing makes the page reload when it is no longer safe to stay.

## Proposed outcome
When a new version is deployed, an open app shows a strip with the words "Update available · Reload", and the person decides when to reload.
When the server says the open page is too old for it, the page reloads by itself, without asking.
A page whose web files can no longer be fetched after a deploy shows the same strip.
The strip never shows when nothing was deployed, and a deploy of the same version again changes nothing.

## Affected users and systems
- Every signed-in person who keeps Toki open across a deploy: Members and Admins.
- The web app (`apps/web`): the strip, the reload, the place of the strip in the main area.
- The server app (`apps/server`): it answers with its own version, and refuses a page that is too old.
- The shared package (`packages/shared`): the numbers that say how old a page may be, and the error code.
- The production build (the image build of TOKI-084 and the deploy of TOKI-085): they give the build a version.
- The WebSocket gateway and the client connection (TOKI-038, TOKI-039): the first frame carries the version.

## Constraints
- When a new version is deployed, an open app shows "Update available · Reload"; the reload is forced only when the server says the page is too old. Source: D-107, NFR-17.
- The strip is the shared `Strip` component; this work builds none of it. Source: plan, TOKI-082 and TOKI-076.
- A page that is too old is found by the server's word, not by a guess of the page. Source: D-107.
- Every text goes through i18n; English is the default language. Source: D-018.
- Nothing about the deploy trigger or the registry is decided here. Source: TOKI-085.
- Milestone M6; size S. Needs TOKI-082. Source: Toki Blueprint, ticket TOKI-104.

## Open questions
- How does the server say that a page is too old? No signal exists yet.
- Where does the version come from, and who gives it to the build?
- Can the person dismiss the strip?
- Does the strip show on a phone while the conversation list is the whole screen?
