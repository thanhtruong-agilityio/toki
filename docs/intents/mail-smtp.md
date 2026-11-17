# Intent: Sending mail over SMTP
Author: Thanh Truong

## Problem
Toki signs people in with a 6-digit code sent by email, and people join only through an invitation that is also sent by email. The server cannot send any mail yet, so neither sign-in nor invitations can work.
The Blueprint does not fix a mail service for phase 1: it fixes configurable SMTP, with Mailpit catching mail in development. Without one mail layer, sign-in, invitations and the emergency access would each send mail in their own way.

Source: Toki Blueprint, decisions D-011, D-027, D-149 and D-157; ticket TOKI-021.

## Proposed outcome
After this work, the server has one mail layer that other server work calls:
- It sends through an SMTP account that the operator sets in the configuration; changing the account needs no code change. In development the mail lands in Mailpit.
- It has two mails, each in English and Vietnamese: the sign-in mail, which carries the 6-digit code and no button, and the invitation mail, which names the workspace and the inviter and carries the Join button and a 6-digit code.
- The sign-in mail is in the language the member chose; the invitation mail is in English.
- When mail cannot be sent, the caller is told, so it can show "Mail not sent" on an invitation. The code and the person's address stay out of the log.

## Affected users and systems
- Members and Admins, who receive the sign-in mail. Source: Toki Blueprint, flow F04.
- People who are invited, who receive the invitation mail. Source: Toki Blueprint, flows F02 and F03.
- The server app (`apps/server`) and the `i18n` package (the mail texts). Source: Toki Blueprint, technical design.
- Later server work that calls the mail layer: the sign-in API (TOKI-022), invitations (TOKI-024, TOKI-097).
- The operator of an installation, who supplies the SMTP account. Source: Toki Blueprint, requirement NFR-12.

## Constraints
- Phase 1 sends through configurable SMTP; a dedicated mail service is decided in a later phase. Source: Toki Blueprint, decision D-027.
- Development uses Mailpit. Source: Toki Blueprint, technical design, infrastructure notes.
- The sign-in mail carries the 6-digit code only and has no button that signs in. Source: Toki Blueprint, decision D-157.
- The invitation mail names the workspace and the inviter and carries a Join button and a 6-digit code; the link alone signs nobody in. Source: Toki Blueprint, decisions D-037 and D-149.
- A code is valid for 10 minutes, the invitation's included. Source: Toki Blueprint, decision D-136.
- Invitations are in English; the sign-in mail is in the language the member chose. Source: Toki Blueprint, decision D-180.
- A batch of invitations is limited to 50 addresses, to protect the mail account's sending limit. Source: Toki Blueprint, decision D-134.
- When mail fails halfway through a batch, the invitations already sent stay and each failed row reads "Mail not sent" with Resend. Source: Toki Blueprint, decision D-099.
- Every text goes through the `i18n` package, in English and Vietnamese, and CI fails on a missing translation. Source: Toki Blueprint, decisions D-018 and D-064.
- Every wording in quotes that the prototype does not contain is a proposal. Source: Toki Blueprint, decision D-139.
- Needs TOKI-004 (server skeleton), TOKI-017 (i18n package), TOKI-096 (configuration) and TOKI-003 (Mailpit). Needed by TOKI-022, TOKI-024 and TOKI-097. Size M, milestone M2. Source: Toki Blueprint, ticket TOKI-021.
- Secrets live in `.env`, never in git. Source: Toki Blueprint, ticket TOKI-096 and infrastructure notes.

## Open questions
- In which language is each mail sent? Source: Toki Blueprint, decision D-180.
- What happens when a sign-in mail cannot be sent? Source: Toki Blueprint, decisions D-099 and D-159, and the open concern of the sign-in API spec.
- Which SMTP account and sender address does production use? Source: Toki Blueprint, requirement NFR-12 ("which account: still open").
- What do the mails say, word for word, in English and in Vietnamese? Source: Toki Blueprint, decision D-139.
- Are failed mails retried? Source: Toki Blueprint, technical design (background jobs) and ticket TOKI-064.
