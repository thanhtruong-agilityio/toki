# Intent: List the accounts, ids and secrets the phone app needs

Author: Huy Nguyen

## Problem

The web app's configuration is known: `docs/environment-config.md` (TOKI-096) lists every environment variable, the values that must come from outside, who owns each one, and how secrets are kept. The phone app needs a second kind of value that this list does not cover: the app's store identifiers, the Apple and Google developer accounts, the iOS signing certificate and provisioning profile, the Android upload keystore, and the credentials for push notifications through APNs and FCM.

Today none of these is listed. The skeleton (TOKI-146) uses the placeholder id `dev.toki.mobile` and leaves the final identifiers to the ticket that sets up store publishing. Builds run on the project's own GitHub Actions, with a macOS runner for iOS, so the signing material must reach CI as GitHub secrets. Without a list, engineers cannot tell which values are needed, which are missing, who must supply them, or which of them can never be replaced once the app is in a store: an Android upload key that is lost, or a published app id, cannot be changed later.

Source: `docs/environment-config.md` and `docs/specs/2026-11-27-mobile-app-skeleton-design.md` (R5, concern 1) on `main`, 2026-11-27; Toki Blueprint, Mobile App Plan, decisions Q1 and Q4.

## Proposed outcome

- There is one list of every account, identifier, certificate, key and credential the phone app needs, with for each: its purpose, the ticket that first needs it, who owns it, whether it is a secret, and where it is kept.
- Every value that builds or signs the app in CI has a named GitHub secret, and the list says which workflow reads it.
- Every value that cannot be replaced once used (the published app ids, the Android upload key) is marked as such, with how it is backed up.
- Engineers know, before MOB-06 (mobile CI) and before the first store upload, which values are in hand and which are still open.

## Affected users and systems

- Users: the engineers who build and ship the app, and whoever holds the company's Apple and Google developer accounts. No member sees this ticket's work. Source: Toki Blueprint, Mobile App Plan, intent IM01.
- Systems: `docs/environment-config.md`, or a mobile section beside it; the GitHub secrets of the repository; later readers: MOB-06 (mobile CI) and the push tickets in the Backlog. Source: Toki Blueprint, Mobile App Plan, MM1.

## Constraints

- Blueprint ticket MOB-02 "Mobile configuration", from web ticket TOKI-096. Scope: app ids, Apple and Google developer accounts, iOS signing certificates and Android keystore as GitHub secrets, push credentials, each with an owner. Size S. Source: Toki Blueprint, Mobile App Plan, MM1, area Foundation.
- Milestone: MM1 "Mobile foundation and design system". Outcome: IM01, "A mobile app in the repository, with the same rules, tooling and CI as the web". Source: Toki Blueprint, Mobile App Plan.
- One app in the stores serves every company; the person types the server address on first launch. The app ids name the publisher, not a customer. Source: Toki Blueprint, Mobile App Plan, decision Q1; mobile-app-skeleton spec, concern 1.
- Builds run on the project's own GitHub Actions, with a macOS runner for iOS, not on EAS. Source: Toki Blueprint, Mobile App Plan, decision Q4.
- Secrets live outside git. No committed file holds a secret, a certificate, a key or a password. Source: `docs/environment-config.md` ("How secrets are kept"); `CLAUDE.md`, Never do 2.
- The list follows the shape of the web inventory and adds to it; it does not change the web rows. Source: `docs/environment-config.md` ("Adding a variable").
- Needs: the `apps/mobile` skeleton, TOKI-146 (MOB-03), for the placeholder app id it replaces. Needed by: MOB-06 (mobile CI). Source: Toki Blueprint, Mobile App Plan, MM1.
- Not in this ticket: the CI workflow that reads the secrets (MOB-06), store listings and store upload, sending push notifications (Backlog). Source: Toki Blueprint, Mobile App Plan.

## Open questions

- What are the final iOS bundle identifier and Android package name, and under which reverse domain?
- Who holds the Apple Developer Program and Google Play Console accounts: a company account or a person, and under which legal name are they enrolled?
- Does this ticket create the accounts, certificates and keystore, or only list them with an owner and a status, as TOKI-096 did for the domain and the VPS?
- Where is the Android upload keystore backed up, given it cannot be replaced, and who may read it?
- Are push credentials (APNs key, FCM service account) listed now, though push is in the Backlog, or left to the push ticket?
- Does Android use Play App Signing, so that the keystore in CI is only an upload key?
