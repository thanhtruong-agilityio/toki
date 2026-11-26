# Intent: PWA
Author: Thanh Truong

## Problem
Toki is a web app, and the decision log says it must be installable: a person adds it to the home screen of a phone or to the desktop and it opens in a window of its own, like an app (D-030, F36, AC-046).
Today the page has no manifest, no icon and an empty favicon, so a browser has nothing to install, an installed copy would show a blank tile, and on an iPhone the Home Screen install that Web Push needs (D-108) is not possible in the form the product wants.
Without this work the push notifications of the notification tickets cannot work on an iPhone at all, and desktop users have no way to keep Toki in its own window.

## Proposed outcome
A supported browser offers to install Toki with its own install action. The installed app opens at the start page in a window without the browser's address bar, with Toki's own icon and name on the home screen, the dock or the app list, and it is installable without any service worker code, because the service worker is for push only (D-030) and nothing is cached for offline use.
The browser tab shows Toki's icon instead of an empty one, and the browser's bar takes the colour of the app.

## Affected users and systems
- Members and Admins on a phone (iPhone and Android) and on a desktop browser, who install Toki.
- The web app (`apps/web`): `index.html`, the static files it serves, its build and its build checks.
- The Web Push work (TOKI-074): it needs the installed app on an iPhone, and it owns the service worker and everything that tells a person to install. This work owns only what makes the app installable.
- The production file server (TOKI-084): it serves the manifest and the icons.

## Constraints
- Installable PWA; the service worker is used for push only. Source: D-030, NFR-06.
- With the network off, no stale page is served from a cache. Source: NFR-06 (measure).
- The web app can be installed to the home screen or desktop from a supported browser, with the browser's install action, and opens in its own window. Source: AC-046, TS-071.
- On a phone, after Add to Home Screen, Toki opens like an app of its own. Source: F36.
- On iPhone, push works only when Toki is installed to the home screen. Source: D-108, F36.
- Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox. Source: D-108.
- English is the default language and every text goes through i18n. Source: D-018, D-064.
- Milestone M5; size S; belongs to the notifications area; the Web Push ticket TOKI-074 is written at the same time. Source: Toki Blueprint, ticket TOKI-077.

## Open questions
- What does "install" mean in phase 1: only the manifest and icons, or also offline use? The log says the service worker is for push only and no stale page is served, so offline use is out; is that the complete answer?
- Which name, theme colour, background colour, display mode, start page and icon sizes does the manifest carry? The log names none of them.
- What does the app icon look like? The prototype has no app icon and the log names no logo.
- Does Toki show its own "Install" button or card? F36 and AC-046 name only the browser's install action.
- On an iPhone, is the person signed in when the installed app first opens? AC-046 says "signed in".
- Who owns the service worker file and its registration, the manifest link, and the iPhone rule?
