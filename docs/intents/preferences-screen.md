# Intent: Preferences screen
Author: Thanh Truong

## Problem
A person has no place to make Toki their own. The Preferences page that exists today holds one section, the list of signed-in devices. The look, the accent colour, the density, the notification switches, Pause and the status, the interface language and the person's own profile (display name, job title, time zone) are not on it, so every device shows the look of the browser's setting, the interface is in English for everyone, a person cannot correct a name, and the switches and the Pause controls that other work has built have no screen to live on.

The prototype keeps these choices in the browser, so a person who picks Focus on the laptop opens Toki on the phone and finds Calm. The product decided otherwise: look, accent, density and language are saved to the account and the same on every device (D-175), and the notification switches belong to the person (D-142). A person whose saved look differs from the device's own light or dark setting also sees the wrong look for a moment at every load, because the page cannot know the saved look before the account has loaded.

## Proposed outcome
The Preferences page holds, in the order of the journey (F35) and of the prototype: Look (Calm, Focus, Match my device), Accent (teal, indigo, clay, violet), Density (Comfortable or Compact, not on a narrow screen), the three notification switches with the device's push block, Pause notifications, the language (English or Tiếng Việt), "Your status", the person's profile (display name of 1 to 80 characters, job title, time zone; no picture) and the list of signed-in devices that the account menu work already built.

Every choice is saved to the account and applied at once, with no reload, on this device and on every other device the person has open. Choosing Tiếng Việt switches the whole interface at once. "Match my device" makes each device follow its own light or dark setting. A person whose saved look differs from the device's setting sees the saved look from the first paint of a visit, not after a flash of the other one. The time zone a person sets is the one every time on their screens is shown in, and the one colleagues read their local time from.

The server side of the display name, job title, time zone, look, accent, density and language belongs to the ticket "Profile and preferences (server)", which has no ticket number yet. This work says what it needs from that ticket and builds the screen, the applying of the choices on the page and the first paint.

## Affected users and systems
- Every Member and Admin: the whole page, on every device.
- The web app (`apps/web`): the page and its sections, the code that applies look, accent, density and language to the page, the first-paint script in `index.html`, the time zone field that the date context reads its zone from, the account card's name, one palette command.
- The sections that other work built or will build, which this work places on the page: the notification switches (TOKI-102), the push block (TOKI-074), Pause and Focus time (TOKI-076), the status editor (TOKI-056), the signed-in devices (TOKI-099).
- The ticket "Profile and preferences (server)": what it must offer, stated here as its contract.
- Colleagues: the display name, job title and time zone of a person are read from the same values on their screens (People, profile panel, messages).

## Constraints
- Look: Calm, Focus, or Match my device; a change shows at once with no reload; Match my device is Focus on a dark device and Calm on a light one. Source: FR-43, AC-120, F35.
- Accent: teal, indigo, clay, violet; Density: Comfortable or Compact, not offered on a narrow screen; each applies at once. Source: AC-122, TS-195, TS-196.
- Language: English by default, Tiếng Việt as the other; a change switches every label at once and never reloads the page; names and message texts are not translated. Source: D-018, AC-121, TS-193, TS-194.
- The three notification switches, with "Notify me for @mentions even in muted channels" on for a new account; no email switch in phase 1; the switches are the person's and the same on every device. Source: FR-44, AC-123, D-088, D-142.
- Pause and the status can be set from Preferences. Source: plan line of TOKI-078, F32, F33.
- Profile: display name of 1 to 80 characters, job title, time zone; no picture upload. Source: F35, D-033, D-118, D-144.
- Signed-in devices, with sign-out of one device or of all others after a confirmation that names its target. Source: D-158, D-069.
- Look, accent, density and language are saved to the account and synced; with Match my device each device follows its own setting. Source: D-175, F35.
- Nothing hover-only, usable at 360 by 560, a button at least 40 px high on a narrow screen. Source: D-067, D-068.
- While the connection is down, every action except sending a message is blocked with an explanation, never a false success. Source: D-079.
- The Look, Device, Clock and Guide bar of the prototype, "Highlight proposed features" and "Claude on this computer" are not part of phase 1. Source: D-145, D-146, D-008.
- Every text goes through i18n; English by default; a wording the prototype lacks is a proposal. Source: D-018, D-139, NFR-05.
- Time and ordering in tests use the controllable clock, never a real timer. Source: TOKI-008 R19.

## Open questions
- What do a new account's look and density start as? The accent starts as teal (decided in the tokens work).
- What is the longest job title?
- How does a person choose a time zone, what does a person who never set one see, and does the profile show a city?
- What does the palette command "Switch look" do when the look is Match my device?
- Who builds the saving of display name, job title, time zone, look, accent, density and language, and what must it offer this screen?
- How does the page avoid showing the other look before the account has loaded?
