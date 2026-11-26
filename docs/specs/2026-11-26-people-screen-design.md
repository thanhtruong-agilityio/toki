# People screen design

Date: 2026-11-26 · Status: draft for review (concerns 1 and 2 are open for the product owner)
Intent: docs/intents/people-screen.md (Thanh Truong)
Ticket: TOKI-079

## Goal
A person has no way to see who is in the workspace. The profile panel (TOKI-057) opens from a message, a member row or a conversation's Details panel, so a colleague the person has never talked to cannot be reached. This ticket builds the People page: the directory of active people as cards, a search by name or job title, the first 50 cards with more on scroll, an empty state, and the press of a card that opens that person's Profile panel at an address of its own. It reads the people the app already holds and makes no request.
The rules that must hold are D-118 (initials on a colour), D-152 (no Owner), D-144 (local time from the person's own zone), D-123 (24 hours), D-109 (50 shown, more on scroll), F41 (a deactivated person is not listed), D-074 (an empty state centred in the content) and D-089 (an address, and Back closes the panel first).

## Scope
- In:
  - The route `/people` and its child `/people/p/$personId`, the section row, the page frame and the search field (R1, R2, R11).
  - Who is listed, the card, its presence, its local time (R3 to R6).
  - The search, the window of 50 with more on scroll, the empty state, the state before the people are loaded (R7 to R10).
  - The press of a card, the panel and Back (R11, R12), the keyboard and touch rules (R13).
  - The texts, the styles, the seam and what does not change (R14 to R18).
- Out (not now), each with its owner:
  - The panel itself (identity block, Message, Set status, Edit profile, "Deactivated", the unknown-person message), its hooks `useOpenProfileAt` and `useCloseProfileAt`, and `useMinuteNow`: TOKI-057. This ticket mounts and uses them (R6, R11).
  - Presence data, the dot and the three words: TOKI-055. Status text and its dialog: TOKI-056. The card shows neither the status nor a city (R4); the status is shown by the panel that a card opens.
  - Where a person's job title and time zone come from and how they are saved: the ticket "Profile and preferences (server)" (no number yet), and the form that edits them: TOKI-078 (concern 3).
  - The More sheet that reaches People on a narrow screen: TOKI-092. This ticket gives the row its `more: true` (R1).
  - Loading placeholders, the Retry of a failed load and the shared "no access" page: TOKI-082. Until it lands the page draws the plain states of R10.
  - The command palette's own choice of a person and its address: TOKI-071.
  - The Guest role and its rule that a guest does not see the directory (phase 5): nothing here knows a guest.
  - The Admin page's member table (TOKI-025): a different screen with its own rows and actions.

## Requirements
Route and frame
- R1. The route and the section. `apps/web/src/routes/people.tsx` exports `peopleRoute`, a child of `appLayoutRoute` (TOKI-015 R30) with the path `/people` whose component is `PeoplePage`, and `peopleProfileRoute`, a child of `peopleRoute` with the path `/p/$personId` (the address `/people/p/{personId}`) and no component; `router.tsx` adds `peopleRoute` with its child to the children of `appLayoutRoute`. `apps/web/src/layout/sections.ts` gains the row `{ id: "people", icon: "users", labelKey: "nav.people", to: "/people", match: p => p === "/people" || p.startsWith("/people/"), more: true }`, with no `roles` (every role sees it), placed before `admin` and `preferences` and after every row that is built before it (the order of the prototype's list, line 1199, as TOKI-015 R30 says). It has no `tab` (the bottom bar shows Home, Activity, Later and Files, TOKI-015 R6) and no `calmHidden`. Check: a test of `sections` finds the row with those values, and the order of the ids of `visibleSections("admin")` ends with `people`, `admin`, `preferences` and that of `visibleSections("member")` ends with `people`, `preferences`; a route test finds `/people` and `/people/p/x` under the layout, with the page inside the shell; the sidebar item has `aria-current="page"` on both addresses.
- R2. The frame. `PeoplePage` (`apps/web/src/people/PeoplePage.tsx`) is a `SectionPage` of TOKI-015 R12 with the title `t("nav.people")`, no `actions`, `toolbar` holding the search field of R7 and `bodyProps` holding the three props that `useMoreOnScroll` returns (R8). It does not edit `SectionPage`: `toolbar` and `bodyProps` are TOKI-015 R12's. The cards are the children, so only the cards scroll and the search field stays in place. Check: a render test finds the heading, then the toolbar with the search field, then the body, in that order, with the field outside the scrolling body.

The list and the card
- R3. Who is listed. The cards are the people of the store (`getPeople()` of TOKI-032 R23, through the seam of R16) whose `status` is `active`, every one of them once, the signed-in person's own card included (AC-116), in the order the store gives them. A person whose `status` is `deactivated` has no card (F41). No request is made: the store already holds every person of the workspace (TOKI-031 R5). Nothing in the page knows an Owner or a Guest. Check: a store of Minh (admin), Sam, Mai and Alex gives four cards in the store's order, Sam's own included; Alex made `deactivated` gives three; a search for "Alex" then shows the empty state (TS-185); a spy on the client finds no call.
- R4. The card. Each card is an `li` of a `ul` (`aria-label` `t("nav.people")`) holding one `button.pcard` (`type="button"`) with, in order: (a) an `Avatar` of TOKI-013 of 46 px with `name` the person's display name, `hue` `personHue(id)` (TOKI-033 R28) and `presence` when R5 gives one: initials on a colour and no picture (D-118); (b) the name in bold; (c) the `Tag` `t("common.role.admin")` after the name when the person's `role` is `admin`, and nothing for a Member: no card carries "Owner" (D-152); (d) the job title in muted text on its own line when it is not empty after a trim, cut by an ellipsis when long; (e) a last row with the presence dot and its word when R5 gives them, a spacer, and the local time of R6 with the `clock` icon, in the mono face, when R6 gives one. The name, the job title and the time are plain text: `<`, `&` and a link are shown as typed. The card shows no picture, no email address (TOKI-031: others' addresses are not returned), no status text and no city (the list of FR-42 is avatar, presence, name, Admin label, job title and local time). A long name or title never widens the card. Check: markup tests of the order for an Admin, a Member, a person with no job title, one with a job title `<b>x</b>` (shown as text) and one with a 200-character name; `getInitials` output for "Mai Vũ" and for a one-word name; the hue equals `personHue(id)`; a scan of the card for `img`, `input` and an `@` address finds none; no text "Owner" in any fixture.
- R5. Presence. The page asks `usePresenceMap(ids)` of TOKI-055 R17 once, for the ids of the cards in the window of R8, and gives each card the state and the word of its person. The avatar's dot is decorative (no `presenceLabel`) and the last row of R4 (e) says the word, so a screen reader reads the state once. When the map has nothing for a person (no snapshot yet, TOKI-055 R17) the card has no dot and no word. The page writes no presence and has no control for it (D-036). Check: a fake map with `active`, `away` and `dnd` shows the three words; a person with no entry shows no dot and no word; a batch that changes a person outside the window does not render the visible cards again (a render counter); no control in the card sets presence.
- R6. Local time. When the person has a `timeZone` that `isValidTimeZone` of `@toki/shared` accepts, the card shows `formatTime(now, timeZone)` of TOKI-094 R1: `HH:mm`, 24 hours, never `AM` or `PM` (D-123), in the zone the person set and not the viewer's (D-144). `now` comes from one call of `useMinuteNow()` of TOKI-057 R6 in `PeoplePage`, handed down to the cards, so the whole list has one timer and the time changes at the next minute of UTC time. When the person has no zone, or `formatTime` returns `null`, the card shows no time and no clock icon (concern 2). `jobTitle` and `timeZone` are read through the local widened person type of TOKI-057 R2 (concern 3). Check, with the `TestClock` and the fake `timers` of TOKI-008 and no real timer: at 10:42:30 UTC a person in `Asia/Ho_Chi_Minh` shows `17:42` and after 30 s of the fake clock `17:43`; one in `Asia/Kolkata` shows `16:12`; `00:05` and `23:59` show two digits; a zone `Mars/Phobos` and a person with no zone show no time; the viewer's own zone (set by the `TZ` variable to `Pacific/Auckland`) changes nothing; two hundred cards make one timer; unmounting leaves no pending timer.

Search and windows
- R7. Search. The toolbar holds one `Field` of TOKI-012 with `variant="search"` and the `search` icon (the prototype's field, line 1633), `type="search"`, `aria-label` and `placeholder` `t("people.search.label")` ("Search people", the prototype's), `maxLength` 80 and no `data-autofocus`. The text is held by the page and filters at each keystroke, with no request and no wait. `matchDirectory(people, text)` in `apps/web/src/people/directory.ts` is pure: it trims the text and keeps the people whose display name contains it, or whose job title contains it, ignoring case; an empty text keeps everyone in the order given; a person with no job title is matched by name only; it never throws. It is the one place that decides a match, so concern 1 changes one function. The cards that remain keep the store's order. Check: "mai" keeps Mai only (TS-186); "market" keeps Mai, whose job title is "Marketing", and no one whose name and title lack it (TS-187); "MAI" and "mai" give the same cards; "  mai " gives the same as "mai"; a person with no job title is not matched by an empty-title false positive; an empty text keeps all; the function is the only one in the folder that compares a typed text with a name.
- R8. The first 50, more on scroll. The window starts at 50 cards (D-109, AC-118). When the end of the scrolling body is within 48 px, or focus enters the last card, and there are more matches than shown, the window grows by 50, until every match is shown. The hook is `useMoreOnScroll` (`apps/web/src/features/useMoreOnScroll.ts`, TOKI-034 R8), whose result goes to `SectionPage` as `bodyProps` and whose default row selector `li` finds the cards (R4), so this ticket passes no `rowSelector` and depends on no edit to the hook. A new search text starts the window again at 50 and scrolls the body to the top. The window is in memory over the list that R3 and R7 produced; nothing is asked of the server. Check: 51 people show 50 cards and, after one scroll of the body near its end, 51 (TS-188); 120 people show 50, then 100, then 120, and a further scroll changes nothing; focus entering the 50th card shows 100; a new text shows at most 50 and the body's `scrollTop` is 0; the hook's existing tests of TOKI-034 still pass.
- R9. Empty. When no person matches the text, the body holds one `EmptyState` of TOKI-013 with the icon `users`, the title `t("people.empty.title")` ("Nobody matches", the prototype's, line 1635) and the description `t("people.empty.hint")` ("Try a name or a job title.", the prototype's), centred in the body (D-074; `.secbody` is a flex column with a height, TOKI-015 R15, and the empty state takes the free height, TOKI-013 R17). No count is shown. An empty text never gives this state: the signed-in person is always listed once the store is ready. Check: a search for `zzzz` shows the title and the hint; in a browser at 360, 720 and 1100 px, in Calm and Focus, the centre of the empty block's content is within 1 px of the centre of the body.
- R10. Before the people are held. While the store's `status` is `idle` or `loading` and it holds no person, and when it is `failed` and holds no person, the body has `aria-busy="true"` and holds no card and no empty state (a list that is not loaded is not "Nobody matches"). When the store holds people, whatever its `status` (a refresh in progress, or a failed refresh), the page shows them. The skeleton, the Retry and the offline wording are TOKI-082's and replace this state. Check: a fake store in each of the four statuses with no person shows no card, no `EmptyState` and `aria-busy`; with people held in `ready`, `loading` and `failed` shows the cards.

Opening a profile
- R11. The press and the panel. A press of a card calls `open(person.id)` of `useOpenProfileAt({ addressOf: id => "/people/p/" + id, replaces: location => location.pathname.startsWith("/people/p/") })` (TOKI-057 R11, R17): from `/people` it pushes `/people/p/{id}` with `state: { profilePushed: true }`; from a profile it replaces the entry, so the history never holds two profiles. `PeoplePage` calls `useShellPanel` once (TOKI-015, `shell-slots.tsx`): with `useParams({ strict: false }).personId` set the panel is `<ProfilePanel personId={personId} onClose={close} />` with the label `t("profile.label")`, where `close` is the function of `useCloseProfileAt("/people")` (TOKI-057 R12); with no `personId` the call passes `null`. The page stays mounted under the panel, so the search text, the window and the scroll position stay. The panel's own buttons (Message, Set status, Edit profile) and the case of an id the store does not hold are TOKI-057's (R8 to R10); a direct address for a person who does not exist shows the page and the panel's "not available" body. Check, on a memory history with the real shell slots: pressing a card from `/people` adds one entry with `profilePushed` and the shell has `data-panel` with the name "Profile"; pressing another card while the panel is open leaves the history length as it was; the typed text and the window are as they were after the press; `/people/p/{id}` opened directly shows the page and the panel for that person; an unknown id shows the page and the panel's unavailable text; a profile press from an Admin and from a Member are the same.
- R12. Back. Back, the panel's Back and Close buttons and Escape each close the panel and end on `/people` with the same search text and scroll position, one entry back and not two (D-089); a profile address opened in a new tab and closed replaces the entry with `/people` (TOKI-057 R12, `profilePushed` absent); after "Message" in the panel the entry is replaced by the conversation, so one Back from there ends on `/people` with no panel (TOKI-057 R8). Leaving the page by another section clears the panel. Check, on a memory history: open then `history.back()`, open then Close, open then Escape each end on `/people` and one entry back; a profile opened by address and closed leaves the length as it was; open, then Message (a fake `openDirect`), then Back, ends on `/people` with no panel; choosing the Activity section while the panel is open clears the shell slot.
- R13. Keyboard and touch. A card is a native `button`, so Tab reaches each one, Space and Enter press it, and focus has the design system's ring (`:focus-visible`). Nothing on a card exists only on hover: the hover rule changes the border and the shadow and hides nothing (TOKI-015 R17). From 719 px and below the grid has one column and every card is at least 40 px tall (F38, D-091). Check: a keyboard-only run opens a profile with Enter and closes it with Escape; the card's computed height at 360 px is at least 40 px; a CSS scan (R15) finds no rule that hides on `:hover`.
- R17. Live changes. The cards follow the store: a person made `deactivated` (`person_set` of TOKI-040 R17) loses their card, a person changed to `admin` or back to `member` gains or loses the Admin tag, a person added to the store gains a card in the store's order, and a presence batch changes the dots, with no reload and no request from this page. A person whose panel is open and who is deactivated keeps the open panel (TOKI-057 R10 shows the label). Check: with a fake store, each of the four changes redraws the list, the window of R8 holds, and the typed text stays.

Texts, look, boundaries
- R14. Texts. `@toki/i18n` gets the namespace `people` (files `people.ts` in `en` and `vi`, one import and one entry in each `index.ts`) with the four keys of Table T. The Admin label is `common.role.admin` (it exists), the heading and the list's name are `nav.people`, and the panel's label is `profile.label` (TOKI-057 R18): this ticket adds none of those. `ui-web` holds no text. Check: both languages have the four keys and `pnpm i18n:check` exits 0; a render in Vietnamese shows the Vietnamese texts; a scan of `apps/web/src/people/` finds no JSX text node with a letter and no quoted English text of Table T outside the tests.
- R15. Styles. `apps/web/src/people/people.css` holds exactly the rules of Table A, value for value, imported by `PeoplePage.tsx`. Every colour is `var(--…)` naming one of the 32 properties of `tokens.css` (TOKI-009 R10), no colour literal, no selector with `data-eff`, `data-look`, `data-accent` or `data-density`, and every `:hover` rule declares only `border-color` and `box-shadow`. At 360 px wide nothing scrolls sideways. Check: a test compares the file with a copy of Table A and walks it for these checks; a browser run at 360 x 560, 719, 720, 1099 and 1100 px, in Calm and Focus, with 120 people including an 80-character name and a 200-character job title: no horizontal scroll, the toolbar stays in view while the body scrolls, the grid has one column at 719 and below and more from 720, and the open panel does not cover the toolbar's field at 1100 px and above.
- R16. The seam and the boundaries. `apps/web/src/people/deps.ts` is the only file of this change that imports the client, the store, `usePresenceMap` (TOKI-055), `useMinuteNow`, `useOpenProfileAt`, `useCloseProfileAt` and `ProfilePanel` (TOKI-057) or `useMoreOnScroll`; it exports `useDirectoryPeople()` (the people of the store through `useConversationSelector((s) => s.getPeople())`, the same array while the state is unchanged, TOKI-032 R22, with no `useMemo` of its own), `useStoreStatus()` (`useConversationSelector((s) => s.getState().status)`), `usePresenceMap`, `useMinuteNow`, `useOpenProfileAt`, `useCloseProfileAt`, `ProfilePanel`, `useMoreOnScroll` and `personHue`; a rename elsewhere changes that file only and the tests replace it with `vi.mock`. The page and its files import no `@toki/client-core`, no `../client`, no `../conversation-list` and nothing of `packages/*` by a relative path. Check: a test reads the files of the folder and fails on those imports outside `deps.ts`; the tests of the page replace `deps.ts`.
- R18. Nothing else changes. No server code, no migration, no request, no change to `ProfilePanel`, `SectionPage`, `useMoreOnScroll` or the store, no change to the bootstrap answer, and no new event. The edits to files of other tickets are `layout/sections.ts` and `router.tsx` (R1), the two `index.ts` of `packages/i18n/src/messages/` (R14) and nothing more, and the pull request names them. Check: the diff outside `apps/web/src/people/`, `apps/web/src/routes/people.tsx` and `packages/i18n/src/messages/{en,vi}/people.ts` is those four files, and `pnpm --filter @toki/web test`, `pnpm --filter @toki/i18n test`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm typecheck` and `pnpm i18n:check` exit 0.

## Design
### What the prototype does, and what this spec does
Read in `docs/blueprint/prototype/index.html` (line numbers are that file's).

| Prototype | This spec |
| :---- | :---- |
| `peopleHtml` (1630): header "People", a toolbar with one search field (max width 340 px), a grid of `button.pcard` (373 to 376) | R2, R4, R7, Table A |
| The card: avatar 46 px with a presence dot (`avp`), the name, a `Guest` tag and a role tag (`p.role`: "Owner", "Admin"), the job title, then a row with a dot and the word of the state, a spacer, a clock icon and the local time in mono | R4 to R6. The role tag is "Admin" only (D-152); no Guest (phase 5); the states are three (no "In a Meet" before phase 4, TOKI-013 R11) |
| The search keeps `(name + " " + title).toLowerCase().includes(q)` with no trim | R7: name or title, each on its own, trimmed. The joined string would match text that spans the end of the name and the start of the title |
| The list holds every person, deactivated people do not exist | R3: active people only (F41) |
| The empty state "Nobody matches" with "Try a name or a job title." | R9, the same words |
| Local time is the clock plus a fixed offset (`localTime`, 1152) | R6: `formatTime` of the person's zone at the real time |
| A press opens the profile in the side panel (`S.panel`) with no address | R11, R12: an address and one Back (D-089) |
| `.pgrid` is one column in the phone block (567) | Table A, at 719 px and below |

### Where each field comes from
```
store person (TOKI-032 getPeople)     id, displayName, role, status       exists today
  + jobTitle, timeZone                "Profile and preferences (server)"  a local widened type until then (TOKI-057 R2)
presence map (TOKI-055)               state, word                         from the snapshot
clock + timers (TOKI-057 useMinuteNow) now, redraw at the next UTC minute
```
`PeoplePage` is a mapping of these into cards with no request of its own. The bootstrap person has four keys today and a strict schema (TOKI-031 R12), so before the server ticket lands no real person has a job title or a zone: the card then shows no job title and no time, and the search by job title finds nothing. The tests use fixtures that carry the keys, as TOKI-057 does.

### Decided in this spec
- Address. `/people/p/$personId`, a path child of `/people` with no component, the way TOKI-057 made the profile a path child of the conversation (its Design, "The address"): the panels are one slot, a path shows the person in the address and a copied link opens the same profile (D-089). The page is the parent's component and stays mounted under the child, which keeps the search text and the scroll.
- The window is in memory. The store holds every person (TOKI-031 R5), so "the first 50, more on scroll" (D-109) is a slice of an array the app already has, grown by 50 as TOKI-034 R19 does for its picker. A request for pages would add a server route and a second source of the same list for no gain.
- The directory includes the signed-in person (AC-116, the prototype), and pressing it opens the own profile with Set status (TS-190).
- The search text is not kept when the page unmounts and is not in the address. The prototype keeps it in a global; the log says nothing, and the other lists of the app (TOKI-034 R5) keep nothing between openings.
- Presence appears on the avatar and in the last row, as the prototype draws both. The avatar's dot is decorative so that the state is announced once.
- One timer for the list (R6): `useMinuteNow()` is called by the page, not by each card.
- Cards are `li` of a `ul` so that the existing hook's default selector `li` finds the last row and the list has list semantics. TOKI-066 adds an optional `rowSelector` to the same hook for its own rows; this page does not use it, so the two tickets can merge in either order.
- `.pcard` takes the prototype's look with two changes: `text-align:left` (a native button) and no `transition` (the base styles already carry the reduced-motion rule, and a card with a border change needs none).
- The state before the people are held draws no text (R10): a new word would be a wording the log does not give, and TOKI-082 owns that state.

### Table T. Texts
Namespace `people`. English that the prototype contains is marked with its line; every Vietnamese text is a proposal for TOKI-080 to review (D-139). The Vietnamese texts use no form of address, so they do not depend on D-188.

| Key | English | Vietnamese (proposal) | Source of the English |
| :---- | :---- | :---- | :---- |
| `people.search.label` | Search people | Tìm người | prototype 1633 |
| `people.empty.title` | Nobody matches | Không có ai phù hợp | prototype 1635 |
| `people.empty.hint` | Try a name or a job title. | Hãy thử một tên hoặc một chức danh. | prototype 1635 |
| `people.localTime` | Local time | Giờ địa phương | prototype's profile row (TOKI-057 R18); read by a screen reader before the time, drawn as visually hidden text |

The hidden text of `people.localTime` is a `span.vh` inside the time part of the card (Table A), so the card's name reads "…, Active, Local time 17:42".

### Table A. `apps/web/src/people/people.css`
| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.pgrid` | `display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:14px; list-style:none; margin:0; padding:0` | 373; the list reset is decided (a `ul`) |
| `.pcard` | `display:flex; flex-direction:column; gap:10px; padding:16px; border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); width:100%; text-align:left; position:relative` | 374; `text-align` and `position` decided (the anchor of the hidden text) |
| `.pcard:hover` | `border-color:var(--muted); box-shadow:var(--shadow)` | 375 |
| `.pcard .vh` | `position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0` | decided: visually hidden text |
| `.pgrid` (`@media (max-width: 719px)`) | `grid-template-columns:1fr` | 567 |

The card's inner rows use the shared utilities `.row`, `.grow`, `.muted`, `.sm`, `.xs`, `.mono` and `.ell` of `utilities.css` (TOKI-015 R1); the avatar's size is its `size` prop.

### Flows
1. Open: the person presses People; the page lists the cards, the first 50; the toolbar's field is empty.
2. Search: the person types; the cards that match stay; none gives "Nobody matches".
3. Open a profile: the person presses a card; the address becomes `/people/p/{id}`; the panel opens; the list, text and scroll stay; Back closes the panel.
4. Message: in the panel the person presses Message; the direct message opens; Back returns to People.

### Layout
```
apps/web/src/routes/people.tsx            peopleRoute, peopleProfileRoute
apps/web/src/layout/sections.ts           the row people (R1)
apps/web/src/router.tsx                   one line (R1)
apps/web/src/people/
├─ PeoplePage.tsx  PersonCard.tsx  directory.ts  deps.ts  people.css   (+ tests)
└─ person-hue.ts                          TOKI-033's file, unchanged
packages/i18n/src/messages/{en,vi}/people.ts   (+ the two index.ts lists)
```

### Hand-offs
| To | What it must do or give |
| :---- | :---- |
| TOKI-057 (profile panel) | Gives `ProfilePanel`, `useOpenProfileAt`, `useCloseProfileAt` and `useMinuteNow` with the names and behaviour of its R6, R11, R12 and R17; `ProfilePanel` and the two hooks are exported from `apps/web/src/profile/index.ts` as its R17 says, and `useMinuteNow` is imported from its file `use-minute-now.ts` through `deps.ts` (the index of 057 names the panel and the card only), so a move changes `deps.ts` only. This ticket needs the panel built |
| TOKI-055 (presence) | Gives `usePresenceMap(ids)` (R17) and the three words; this ticket draws the dot and the word |
| TOKI-056 (status) | The status text and the Set status dialog are shown and opened by the panel; the card draws no status |
| TOKI-094 (date rules) | `formatTime` and `isValidTimeZone` of `@toki/shared`, used as they are |
| TOKI-015 (app shell) | `SectionPage` with `toolbar` and `bodyProps` (R12), the section list and its order (R30), the panel slot; this ticket adds one row and one route and changes nothing else |
| TOKI-034 (browse and picker) | `useMoreOnScroll` used as it is, with its default selector `li` |
| TOKI-031, TOKI-032, TOKI-033 | The people list (`getPeople()`), the store's status and `useConversationSelector`, `personHue`; used as they are |
| "Profile and preferences (server)" and TOKI-078 | Add `jobTitle` and `timeZone` to the bootstrap person and the form that saves them; until then the card shows neither (concern 3) |
| TOKI-082 | Replaces the plain state of R10 with its skeleton and Retry |
| TOKI-092 | Draws the More sheet whose row for People is the section row of R1 |
| TOKI-080 | Reviews the Vietnamese texts of Table T |

## Testing
Written test first; fake names and ids only. Vitest with jsdom and Testing Library, `user-event` for keys and presses; `deps.ts` is replaced by `vi.mock`; the i18n and router providers wrap each render. Times use the `TestClock` and fake `timers` of TOKI-008, never a real timer.
- R1: the `sections` tests and the route and shell tests named there.
- R2: the render-order test and the check that `SectionPage` is not changed.
- R3, R17: fake stores with the four people of TS-184 and TS-185; each live change; the spy on the client.
- R4: the markup and text tests for the cases named; the scans for pictures, inputs, addresses and "Owner".
- R5: the fake presence map with the three states and a missing entry; the render counter for a batch outside the window.
- R6: the fake clock cases, the invalid zone, the viewer's zone, one timer for 200 cards.
- R7: `matchDirectory` unit tests (name, title, case, trim, empty, no title) and the page tests TS-186 and TS-187.
- R8: 51, 120 and focus cases; the reset on a new text; the existing hook tests.
- R9, R10: the empty state, its centring in a browser, and the four store statuses.
- R11, R12: memory-history tests with the real shell slots for the press, the replace, the direct address, the unknown id, Back, Close, Escape, the Message sequence and a section change.
- R13: the keyboard run and the height at 360 px.
- R14, R15: the i18n check and both languages; the CSS comparison and walk; the browser run at the widths named.
- R16, R18: the import scan and the diff check; the commands named in R18.
- Browser checks are recorded in the pull request, one line for each width, in Calm and Focus, and one run on a touch emulation.
- Not covered here, by design: the panel's own behaviour (TOKI-057), presence and status (TOKI-055, TOKI-056), the server's refusal of a read by a person who is not signed in (TOKI-088).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Initials on a colour, no picture (D-118) | R4 (a) and its scan for `img` |
| No Owner; "Admin" label (D-152, AC-116) | R3, R4 (c) |
| Local time from the person's zone, 24 hours (D-144, D-123) | R6; a person with no zone is concern 2 |
| Search by name or job title; first 50, more on scroll (D-109, AC-117, AC-118) | R7, R8; the diacritics and the order are concern 1 |
| A deactivated person is not listed (F41) | R3, R17 |
| Empty state centred, written for the search (D-074) | R9 |
| A card opens the Profile panel; an address; Back closes the panel first (FR-42, D-089) | R11, R12 |
| Usable on a phone with no hover (D-053, D-067) | R13, R15 |
| Texts in both languages; unlisted wording is a proposal (NFR-05, D-018, D-139) | R14, Table T |
| Milestone M6, size S, needs TOKI-055, TOKI-056, TOKI-094 | Scope, Hand-offs, R18 (one page, no server work) |

## Open questions from the intent
- Does the search match Vietnamese typed without diacritics, and in what order are the cards listed? Not answered. Carried forward as concern 1.
- What does a card show for a person who has not set a time zone? Not answered. Carried forward as concern 2.
- Where do the job title and the time zone come from, since the people the app holds carry neither today? Answered: the ticket "Profile and preferences (server)", placed before TOKI-078 and TOKI-057 by the merged accounts spec (TOKI-019 concern 8); this page reads them through TOKI-057 R2's local type (R6, concern 3).
- Does the card show the person's status or a city? Answered: neither; FR-42 lists avatar, presence, name, Admin label, job title and local time, and the status is shown by the panel (R4, concern 4).
- What address does the profile panel have on this page? Answered: `/people/p/{personId}`, with the history rule of TOKI-057 (R11, concern 5).

## Areas of concern
1. Search without diacritics, and the order of the cards. Not decided. D-177 asks both and is Open: its text proposes matching without diacritics, as Ctrl+K does (D-015), and cards in alphabetical order of display name. The product owner decided the same for the conversation list and the people picker (TOKI-032 concern 8) and said that D-177 is a separate entry that stays open. Today `matchDirectory` ignores case only (R7, the prototype's rule), so "nguyen" does not find "Nguyễn". The order is the one the store gives, `lower(displayName)` in byte order (TOKI-031 R5), which puts a name that starts with "Đ" after "Z". Proposal, not a decision: fold diacritics with `foldSearchText` of TOKI-032 R19 (it also lowers the case, so `matchDirectory` would call it for the name, the title and the text) and sort the cards with a locale-aware comparison of the display name. Question for the product owner: confirm both, or keep case-only matching and the store's order. The answer goes into `decisions.md`; the match is one function and the order one line, so the change is small. Owner: Thanh Truong (product owner).
2. A card for a person with no time zone. Not decided. No decision gives a new account a time zone, and D-144 covers only a zone that was set; this is the question of concern 2 of TOKI-057 asked for the card. Before the server ticket lands every real person has none. Proposal, not a decision: the card shows no time and no clock icon (R6), and nothing is guessed from the viewer's device; the row keeps the presence part on the left. Question for the product owner: should a new account get a zone (for example the browser's at first sign-in), and what should a card show until one is set. The answer goes into `decisions.md`. Owner: Thanh Truong (product owner).
3. The source of the job title and the time zone. Decided: the merged accounts spec (TOKI-019 concern 8, decided by the product owner on 2026-11-18) places a server ticket "Profile and preferences (server)", with no number yet, that adds both to the person and to the bootstrap answer before TOKI-078 and TOKI-057. This ticket adds no column, request or schema key and reads the two through the local widened type of TOKI-057 R2. Until that ticket is built no real card shows a title or a time, and the search by job title finds nothing; the code and the tests are complete with fixtures. Owner: Thanh Truong.
4. The contents of a card. Decided in this spec: the card holds what FR-42 lists (avatar, presence, name, Admin label, job title, local time) and the prototype's card draws, and no status text and no city. The city of D-144 is the question of concern 1 of TOKI-057 for the profile, not for the card. Reason: FR-42 and the plan line of TOKI-079 name the card's fields and neither names the status or a city. Owner: Thanh Truong.
5. The address of the panel on this page. Decided in this spec: `/people/p/{personId}`, a path child of `/people` that draws nothing, with the history rule and the Back of TOKI-057 R11 and R12 through its `addressOf`, `replaces` and fallback `/people`. Reason: D-089 gives every place an address and the profile of TOKI-057 is a path child for the same reason; TOKI-057 R17 leaves the address to this ticket. Owner: Thanh Truong.
6. The window is in memory and the list has no request. Decided in this spec (Design, "Decided in this spec"). Reason: the store holds every person of the workspace (TOKI-031 R5, D-109 sizes the lists at 200 people), so a slice of 50 grown by 50 meets D-109 with no server route. Owner: Thanh Truong.
7. The state before the people are held. Decided in this spec: no card and no empty state while the store has no person, `aria-busy` on the body, and no new text (R10). Reason: "Nobody matches" would be false for a list that is not loaded, and the loading and failure wording belongs to TOKI-082 (D-126, D-139). Owner: Thanh Truong.
8. The signed-in person's card and the Guest. Decided: the person's own card is listed (AC-116, the prototype) and opens the own profile (TS-190); the rule that a guest does not see the directory (F44) is phase 5 and no code here knows a guest. Owner: Thanh Truong.
