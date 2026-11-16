# Intent: AppShell in three layouts
Author: Thanh Truong

## Problem
Every phase 1 screen of Toki sits inside the same frame: the navigation, the conversation list, the main area and the side panel. The prototype builds this frame in one HTML file with one grid, two sets of CSS rules (Calm and Focus) and one phone block, and it draws the frame correctly only in the window sizes that its demo shows. Measured in the prototype, three of its behaviours break rules that the decision log has since fixed:
- From 720 to 1099 px a side panel (thread, details, profile) squeezes the chat to a strip, instead of overlaying it (D-068).
- In a window 560 px high the conversation list of the Calm sidebar shrinks to a few pixels, and the Focus navigation is cut off, instead of the navigation scrolling and the conversation list staying the main area of the sidebar (D-068).
- On a narrow screen the toasts sit at the top of the window instead of above the bottom bar, because the rule that places them reads a variable that does not exist where the toasts are drawn (D-078).
The prototype also draws a bottom bar that differs from the accepted journey (Meet and Mail instead of Later and Files), shows navigation items for features that are not in phase 1, and leaves the tab row of a conversation, the section pages and the pane bodies without a frame that lets an empty list centre itself (D-074).
Without one shared shell, each screen ticket would copy these rules and break them again at its own width.

Source: Toki Blueprint, ticket TOKI-015; the prototype; decisions D-053, D-067, D-068, D-074, D-078, D-089.

## Proposed outcome
The web app has an AppShell that draws the frame in three layouts and that every later screen is placed in:
- Calm, from 720 px: a sidebar with the workspace name, the search box, the navigation items, the conversation list and the account card, beside the main area and, when open, a side panel.
- Focus, from 720 px: a narrow icon rail and a separate conversation column on Home, beside the main area and the side panel.
- Narrow, under 720 px: one pane at a time (conversation list, main area or side panel) with the bottom tabs Home, Activity, Later, Files and More. The More sheet that the More tab opens is a later ticket (TOKI-092); the tab appears when the sheet exists.
Between 720 and 1099 px a side panel overlays the chat; from 1100 px it stands beside it. The smallest supported window is 360 by 560 px. The navigation and the tab row of a conversation scroll when they are short of room, and the conversation list is always the main area of the sidebar.
The frame also supplies what the screens inside it rely on: the tab row, the section page frame, the side panel frame, the utility classes of the prototype, the narrow body text size, the places where toasts are anchored and kept above the composer and the bottom bar, and the look, accent and density attributes on the page.
The shell shows only what phase 1 has. A person on a phone reaches every phase 1 feature (D-053, D-067).

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member and Admin, on every screen and on every window size from a phone to a wide desktop. Source: Toki Blueprint, intent I02 design-system.
- Systems: `packages/ui-web` (a shell folder, the utility style sheet, the appearance function), `apps/web` (a layout route that mounts the shell, the section list, the page-wide style sheet, `index.html`), the catalogs of `packages/i18n` (a few navigation keys). Readers later: the conversation list (TOKI-033), the screens of M2 to M5, the More sheet (TOKI-092), the account menu (TOKI-099).

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-015.
- Belongs to Blueprint intent I02 design-system, whose result is that every base component matches the prototype in Calm and Focus, in all three layouts. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: L. Source: Toki Blueprint, ticket TOKI-015.
- Needs: TOKI-012 and TOKI-013. Source: Toki Blueprint, ticket TOKI-015, Needs column. The specs of TOKI-012 and TOKI-013 hand this ticket the tab row, the badge position on a navigation item, the narrow body text size, `#root`, the utility classes, the search box, the content-area frames and the mounting of the toasts; the shell also uses the icons, the translations, the tokens and the web skeleton.
- Needed by: TOKI-033 (the conversation list). Source: Toki Blueprint, Needs column.
- Agreed scope: three layouts, Calm, Focus and narrow under 720 px with bottom tabs. Per D-068: the smallest size is 360 x 560; from 720 to 1099 px side panels overlay the chat; navigation and the tab row scroll; the conversation list is the main area of the sidebar. Source: Toki Blueprint, ticket TOKI-015; D-068.
- No feature is hover-only or desktop-only; every action has an entry point on narrow and touch screens. Source: D-067, requirement NFR-02.
- Toasts and floating bars never cover the composer or the navigation. Source: D-078, requirement NFR-09.
- Every searchable or filterable list has an empty state centred in the content area. Source: D-074.
- Every control is at least 40 px tall on a narrow screen. Source: journey F38, accepted as the baseline in D-091.
- Every phase 1 screen is checked at 360 x 560, 719, 720, 1099 and 1100 px: nothing clipped, nothing unreachable. Source: requirement NFR-01.
- Phase 1 has Home, Activity, Later, Files, People, Preferences, the command palette and the Admin page for Admins; Mail, Calendar, Meet, Tasks, the guest portal and the demo bar are later phases or dropped. Source: D-002, D-006, D-007, D-145, Toki Blueprint scope.
- Both looks are built, English is the default language and every text is translated. Source: D-018, D-064, requirement NFR-05.
- Look, accent and density are saved to the account and apply at once; "Match my device" follows the device's light or dark setting. Source: D-175, AC-120, AC-122.
- The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library. Source: Toki Blueprint, technical design, Frontend.
- The initial JavaScript stays under 200 KB compressed. Source: requirement NFR-13; TOKI-006.
- TOKI-014 (Overlays) and TOKI-016 (Component preview page) are written at the same time and meet this ticket at the overlays' stacking order and Escape, and at the preview of the layouts.
- M1 exit check that this ticket supports: the component preview page matches the prototype in Calm and Focus at all three layouts. Source: Toki Blueprint, milestone M1.

## Open questions
- What does the shell build, and what does it leave to the screens that sit inside it (the conversation list, the conversation header, the panels, the account menu, the strips)?
- What does "narrow" measure, the window or a frame, and is a window of exactly 720 px narrow?
- The prototype's rule that places toasts above the bottom bar does not work, and the prototype's frame leaves the navigation clipped at 560 px and the chat squeezed at 800 px. What does the shell build instead?
- Which navigation items and which bottom tabs exist in phase 1, and what does the bottom bar show where the prototype and journey F38 differ?
- Who sets the look, accent and density attributes on the page, and what does the page show before the account has loaded?
