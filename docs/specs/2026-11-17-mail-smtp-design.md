# Sending mail over SMTP design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/mail-smtp.md (Thanh Truong)
Ticket: TOKI-021

## Goal
Sign-in by emailed code and invitations by email both need the server to send mail, and nothing in the server can do it yet. This work adds one mail layer in `apps/server` that sends through an SMTP account named in the configuration, and the two mails the first phase needs, the sign-in mail and the invitation mail, each in English and Vietnamese. Later server work calls the layer and writes no mail code of its own.

## Scope
- In:
  - A server module `mail` with two operations, one per mail, and the result they return.
  - The `mail` area of the server configuration: the SMTP host, port, security mode and login, and the sender address and name.
  - The two templates, each with a text part and an HTML part, English and Vietnamese, and their texts in the `i18n` package (namespace `mail`).
  - Timeouts, the connection limit, the rule that the layer does not retry, what is logged and what never is.
  - Tests against a real SMTP server started by the test, and one check against Mailpit.
- Out (not now):
  - Choosing the production SMTP account, the sender address and the domain, and any mail-domain setup such as SPF or DKIM: external values of TOKI-096 (R6 of that spec), owner Thanh Truong. This work reads whatever account the configuration names (concern 2).
  - Deciding when a mail is sent, to whom and with which code, and the code rules: TOKI-022 for the sign-in mail; TOKI-024 for the invitation (creating it, the batch of up to 50, "Mail not sent" and Resend, the record of who invited whom); TOKI-097 for accepting it and the page behind Join.
  - The Join link itself: its address and the token in it belong to TOKI-097 and TOKI-024. This work receives the finished address and puts it in the mail.
  - What a person reads when a mail is not sent: TOKI-022 and TOKI-023 for sign-in, TOKI-024 for an invitation (concern 1).
  - The emergency sign-in link for when mail is down: TOKI-026.
  - A job queue, a worker and retries after a failure: TOKI-064. This layer makes one attempt (R17).
  - Receiving mail, bounce handling, the Mail section of the app, the email about missed mentions (phase 5), a mail service other than SMTP.

## Requirements
- R1. `apps/server/src/modules/mail/` exists, and its `index.ts` is the only entry other code imports. It exports `createMailLayer`, the type `MailLayer` with the two operations of R6 and R9, and the type `MailResult` of R6. A search of `apps/server/src` finds no import of a file inside `modules/mail/` from outside it other than through `index.ts`, and no `nodemailer` import outside `modules/mail/`.
- R2. The server configuration of TOKI-004 gets a `mail` area with these variables, defined in "Configuration": `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`. Every name is a row of the TOKI-096 inventory and a line of `.env.example`; where the inventory already names a row for the same value, that name is used instead and this list is read with it. A test compares the names the area reads with `.env.example`, as TOKI-004 R13 does.
- R3. With a required variable of the `mail` area missing or empty, or a value that fails its check, the server does not start: it exits with code 1 and writes the variable name to standard error, never the value (TOKI-004 R3, R4). The checks: `SMTP_HOST` is not empty; `SMTP_PORT` is an integer from 1 to 65535; `SMTP_TLS` is one of `none`, `starttls`, `tls`; `MAIL_FROM_ADDRESS` is a well-formed address; `SMTP_USER` and `SMTP_PASSWORD` are either both set or both unset; `MAIL_FROM_NAME` has no line break.
- R4. When the environment name is `production` and `SMTP_TLS` is `none`, the server does not start and names `SMTP_TLS`. With `SMTP_TLS` `starttls` the layer refuses to send when the server does not offer STARTTLS, and with `starttls` or `tls` it checks the server's certificate; no variable switches the certificate check off.
- R5. Changing only the SMTP and sender variables changes where the mail goes and who it comes from, with no change of code (requirement NFR-12). Test: two test SMTP servers, one configuration for each, differing in host, port and sender; the same call delivers to the server its configuration names, with that sender.
- R6. `sendSignInMail({ to, code, language })` returns a promise of `MailResult` and never throws, never rejects. `MailResult` is `{ ok: true }` or `{ ok: false, reason }` with `reason` one of `invalid_input`, `recipient_rejected`, `auth_failed`, `unavailable`, `rejected` (R16). `language` is `en` or `vi`. A `code` that is not exactly 6 ASCII digits, or a `to` that is not a well-formed address, returns `invalid_input` and opens no connection.
- R7. The sign-in mail is addressed to `to`, from `MAIL_FROM_NAME` and `MAIL_FROM_ADDRESS`, with the subject of the key `mail.signIn.subject`. Its text part and its HTML part both hold the code as 6 digits in one piece, with no space or dash inside it, and the sentence that the code works for 10 minutes (D-136). The subject holds no code.
- R8. The sign-in mail holds no link and no button: neither part holds `href`, `<a`, `http://`, `https://`, `www.` or `<img`, and the HTML part has no `<form`, `<button` or `<script` (D-157). The language of the text and the HTML is `language`; an invitation has no language argument (R10).
- R9. `sendInvitationMail({ to, code, workspaceName, inviterName, joinUrl })` returns a `MailResult` as in R6. `joinUrl` must be an absolute `http://` or `https://` address, else `invalid_input`. `workspaceName` and `inviterName` must be non-empty after trimming, else `invalid_input`. The mail names the workspace and the inviter, holds a Join button, shows the 6-digit code in one piece, says that the code works for 10 minutes and that the invitation lasts 7 days (D-149, D-136, D-037).
- R10. The invitation mail is always in English (D-180). The HTML part has the Join button as a link to `joinUrl` with the visible label of the key `mail.invitation.join`, and the text part holds `joinUrl` in full on a line of its own, because a text part has no button. Nothing in either part signs a person in without the code: the mail holds the address `joinUrl` and the code, and no other link (D-149).
- R11. Both mails are sent as multipart with a text part and an HTML part, in UTF-8, with the header `Auto-Submitted: auto-generated`. The HTML part loads nothing from outside: no image, no style sheet and no font from an address, no tracking pixel, and the links in it are the one of R10 and none else. Vietnamese letters and the subject arrive intact when read back from the receiving server.
- R12. A value that came from a person is never put into the mail as markup or as a header line. `workspaceName` and `inviterName` are escaped in the HTML part, and their line breaks and control characters are replaced by a space in the subject and every other header. Test: a workspace name with `<script>` and an inviter name with a line break followed by `Bcc: x@example.com` give a mail with no `<script>` tag, no `Bcc` header and the names visible as text.
- R13. The layer logs no code, no recipient address, no `joinUrl`, no message body and no SMTP password, on success and on failure, and the transport's own debug output is off. Test: with the server's log captured, standard output and standard error captured, and a test SMTP server that accepts, and again with one that refuses, the sent code, the recipient address, the `joinUrl` and the password appear nowhere in what was captured.
- R14. Each send writes exactly one log line from the layer. On success: level `info`, the event `mail_sent`, the template name (`sign_in` or `invitation`), the duration. On failure: level `warn`, the event `mail_send_failed`, the template name, the `reason` of R6, the SMTP reply code when there is one, the duration. A caller that gets `invalid_input` gets one `warn` line with the event `mail_invalid_input` and the template name.
- R15. A send is bounded in time. Connecting, the greeting and each socket wait are 10 seconds; the whole send is abandoned after 30 seconds. A test SMTP server that accepts the connection and never answers gives `{ ok: false, reason: 'unavailable' }` within the whole-send limit. The limits are inputs of `createMailLayer` so the test can shorten them; the defaults are these.
- R16. A failure is sorted into one reason: no connection, DNS failure, TLS failure, timeout and any SMTP 4xx reply -> `unavailable`; reply 535 or 534, or a login refused -> `auth_failed`; a 5xx reply to the recipient (550, 551, 553) -> `recipient_rejected`; any other 5xx reply -> `rejected`. Test: one test SMTP server per case answers with the reply and the result is checked.
- R17. The layer makes one attempt per call. A 4xx reply, a timeout or a lost connection is not retried; the same message is not sent twice. Test: a test SMTP server that answers 451 to the first message counts exactly one delivery attempt for one call.
- R18. The server starts and answers `GET /healthz` with the SMTP host unreachable: the layer opens no connection at startup and does not check the account (D-159: mail down must not stop the server). The first connection is made by the first send.
- R19. The layer keeps a pool of at most 2 connections. Test: 10 sends started together against a test SMTP server that counts open connections never show more than 2 at once, and all 10 mails arrive.
- R20. `createMailLayer` returns the layer and a `close` function that closes the pool. The app registers `close` as a close hook of TOKI-004 R15, so SIGTERM leaves no open connection. Test: after `app.close()`, the test SMTP server reports no open connection.
- R21. `buildApp` takes one more optional input, `mail`, a `MailLayer`; when absent it builds the real one from `config.mail`. The layer is on the app as `app.mail`. A test passes a fake layer that records its calls, so no test of another module needs an SMTP server. This is the only change to `buildApp`.
- R22. Every visible word of both mails comes from `@toki/i18n` keys of the namespace `mail`, in English and in Vietnamese; the module holds no sentence, label or subject of its own. `pnpm --filter @toki/i18n check` passes with the new keys. Test: the render functions take the translate function as an argument; with one that returns `[[key]]` for every key, the visible text of each mail, with markup removed, holds only `[[key]]` markers, the code, the names, the `joinUrl` and punctuation.
- R23. In development the mail layer, run with the development values of `.env.example` and the services of TOKI-003 up, delivers one mail of each kind to Mailpit, readable in its inbox with the code and, for the invitation, the Join button. Check at build, by hand with `pnpm dev:up` and a script that calls the layer; this check is not part of `pnpm test` because it needs the service.

## Design
### Configuration
The `mail` area is one more schema in `config.ts` (TOKI-004 R2, concern 11): the server loads it with the other areas; a command-line tool that does not send mail does not load it. Names, values and flags below are the rows this work adds to the TOKI-096 inventory (TOKI-096 R10, concern 10: a ticket that needs a missing variable adds the row and the `.env.example` line in its own pull request). Decided in this spec: the names, because the inventory names the category "Mail over SMTP" but fixes no variable.

| Name | Purpose | Required | Default | Development value | Secret |
| :---- | :---- | :---- | :---- | :---- | :---- |
| `SMTP_HOST` | SMTP server address | yes | none | `127.0.0.1` | no |
| `SMTP_PORT` | SMTP server port | yes | none | the Mailpit SMTP host port of TOKI-003 (Mailpit's own default is 1025) | no |
| `SMTP_TLS` | `none`, `starttls` (upgrade required) or `tls` (TLS from the first byte) | no | `starttls` | `none` | no |
| `SMTP_USER` | Login; with `SMTP_PASSWORD`, both or neither | no | none | empty | no |
| `SMTP_PASSWORD` | Password of the login | no | none | empty | yes |
| `MAIL_FROM_ADDRESS` | Sender address | yes | none | `toki@example.com` | no |
| `MAIL_FROM_NAME` | Sender name | no | `Toki` | `Toki` | no |

The default of `SMTP_TLS` is `starttls`, so a production server with the variable unset does not send in clear (R4). Mailpit takes no login and no TLS, so the development value is `none` with no login.

### API
Server-internal functions, not HTTP routes.
| Operation | Input | Result |
|---|---|---|
| `sendSignInMail` | `to`, `code`, `language` (`en` or `vi`) | `MailResult` |
| `sendInvitationMail` | `to`, `code`, `workspaceName`, `inviterName`, `joinUrl` | `MailResult` |

The callers decide whether a failure matters. The layer only reports it and logs one line (R14).

### What each mail says
The texts are in the table, with their keys. Facts with a source: the code, the 10 minutes (D-136), the 7 days (D-037), the word "Join" (journeys F02 and F03; the label of the button), no button in the sign-in mail (D-157). Every sentence and subject is a proposal (D-139): the prototype has no mail text, only the screen sentence "We sent a 6-digit code to … It works for 10 minutes." (guest sign-in), and the journeys give no wording. The Vietnamese uses "bạn", which is a proposal too (D-188 is Open, concern 4). `{inviter}`, `{workspace}`, `{minutes}` and `{days}` are placeholders of `@toki/i18n` (TOKI-017 R5).

| Key | English | Vietnamese |
| :---- | :---- | :---- |
| `mail.signIn.subject` | Your Toki sign-in code | Mã đăng nhập Toki của bạn |
| `mail.signIn.intro` | Use this code to sign in to Toki: | Dùng mã này để đăng nhập vào Toki: |
| `mail.signIn.validity` | The code works for {minutes} minutes and can be used once. | Mã có hiệu lực trong {minutes} phút và chỉ dùng được một lần. |
| `mail.signIn.ignore` | If you did not ask for this code, you can ignore this email. | Nếu bạn không yêu cầu mã này, hãy bỏ qua email này. |
| `mail.invitation.subject` | {inviter} invited you to {workspace} on Toki | {inviter} đã mời bạn vào {workspace} trên Toki |
| `mail.invitation.intro` | {inviter} invited you to join {workspace} on Toki. | {inviter} đã mời bạn tham gia {workspace} trên Toki. |
| `mail.invitation.join` | Join | Tham gia |
| `mail.invitation.codeIntro` | Press Join, then enter this code: | Nhấn Tham gia, rồi nhập mã này: |
| `mail.invitation.validity` | The code works for {minutes} minutes. If it has expired, press Resend code on the next page. | Mã có hiệu lực trong {minutes} phút. Nếu mã đã hết hạn, hãy nhấn Gửi lại mã ở trang tiếp theo. |
| `mail.invitation.lifetime` | The invitation lasts {days} days. | Lời mời có hiệu lực trong {days} ngày. |
| `mail.invitation.ignore` | If you did not expect this invitation, you can ignore this email. | Nếu bạn không mong đợi lời mời này, hãy bỏ qua email này. |

- The Vietnamese invitation texts exist because the missing-translation check requires every English key to have a Vietnamese text (D-064). They are not sent in phase 1: the invitation is in English (D-180, R10). The render function takes a language so that the day D-180 changes, only the call changes.
- Vietnamese "Gửi lại mã" is a proposal for the button "Resend code" of TOKI-023; TOKI-023 owns that label and the two must read the same. If TOKI-023 words it otherwise, this key follows it (hand-off, concern 3).
- `{minutes}` is 10 and `{days}` is 7, set once as constants in the `mail` module with a test that pins them to the values of D-136 and D-037. A later change of the code lifetime in TOKI-022 must change this constant too; the hand-off is named in concern 8.
- The sign-in mail's layout: the intro line, the code on its own line (large, monospaced, in the HTML part), the validity line, the ignore line. The invitation mail's layout: the intro line, the Join button, the code intro, the code, the validity line, the lifetime line, the ignore line. No logo image: the HTML part loads nothing from outside (R11).

### Layout
```
apps/server/src/modules/mail/
├─ index.ts        public entry: createMailLayer, MailLayer, MailResult
├─ layer.ts        the two operations, the pool, the timeouts, the result and the log line
├─ render.ts       renderSignInMail, renderInvitationMail: pure functions that return subject, text and html
├─ classify.ts     sorts an SMTP or network error into a reason (R16)
└─ config.ts       the mail area schema, added to config.ts of TOKI-004
packages/i18n/src/messages/{en,vi}/mail.ts    the keys of the table above
```
- Library: Nodemailer for the SMTP client, with its pool. Decided in this spec: the Blueprint fixes SMTP and no library; Nodemailer is the usual Node client with STARTTLS, pooling and UTF-8 header encoding, so none of that is written here. It is used inside `modules/mail/` only (R1).
- `createMailLayer({ config, logger, timeouts? })`. `buildApp` calls it with `config.mail` and the app's logger and registers `close` (R20, R21).
- Render functions are pure and take `t` (the translate function bound to a language, `createTranslator` of TOKI-017 R9) and the values; the server calls `translate` through `@toki/i18n` on the main entry that has no React (TOKI-017 R21).
- The HTML part is a small hand-written table layout with inline styles, as mail clients need, no script and no remote load. The text part is the same content with the Join address on its own line.
- Logging: the layer uses the app's logger and writes the fields of R14 only. Nodemailer's `logger` and `debug` options stay off, because with them on the message body, and so the code, reaches the log (R13).
- Decided in this spec: the layer writes no recipient address to the log, even though the address is not a secret. The sign-in API makes the same choice for its module (its R37), the address is personal data, and the callers already know which address they asked about.

### Errors
- Bad input to an operation -> `{ ok: false, reason: 'invalid_input' }` and no connection (R6, R9).
- Cannot connect, TLS or DNS failure, a timeout, a 4xx reply -> `unavailable` (R15, R16).
- Login refused -> `auth_failed`. A 5xx reply to the recipient -> `recipient_rejected`. Any other 5xx -> `rejected` (R16).
- The layer never throws and never rejects; a bug inside it that would throw is caught and returned as `unavailable` with the error logged without any input value.
- Missing or invalid mail configuration -> the server does not start (R3, R4).

## Testing
- Written test-first, as server tests with Vitest. The tests start a real SMTP server of their own in the test process (`smtp-server`, listening on an ephemeral port on 127.0.0.1) and read what it received with `mailparser`; both are development dependencies of `apps/server` and no test uses Mailpit or the network. A helper starts it with a behaviour: accept, answer a given reply code to a given command, accept and never answer, count connections. Addresses are of the form `sam@example.com`; codes in tests are made-up digits.
- Render tests (R7 to R12, R22): the pure functions in both languages; the words checked against the table above; the code in one piece; the absence list of R8 on both parts of the sign-in mail in both languages; the one link of the invitation; the escaping and header cases of R12; the translate function that returns `[[key]]` (R22).
- Send tests (R5 to R7, R9 to R11, R15 to R17, R19, R20): a full send of each mail to the test server, parsed back for the sender, recipient, subject, both parts, the header and the UTF-8 round trip of Vietnamese; the two-server test of R5; the reply-code cases of R16; the 451 case with one attempt (R17); the server that never answers with shortened limits (R15); 10 concurrent sends with the connection count (R19); the open connections after `app.close()` (R20).
- Log tests (R13, R14): a capture stream for the app logger plus capture of standard output and standard error; success, each failure reason and invalid input; exactly one layer line per send with the fields of R14; a search of everything captured for the code, the address, the `joinUrl` and the password.
- Configuration tests (R2 to R4, R18): fake environments, each variable missing, empty and invalid in turn, the login pair, production with `none`, the check that the submitted value is absent from the error output (as TOKI-004 R4), and the names against `.env.example`. A process test starts the server with an SMTP host that nothing listens on and checks that `/healthz` answers ok (R18).
- Boundary test (R1): a script search of `apps/server/src` for imports into `modules/mail/` other than `index.ts` and for `nodemailer` outside the module; TOKI-002's boundary rule also covers the first.
- `buildApp` with a fake `mail` (R21): a test route calls `app.mail` and the fake records it, with no SMTP server.
- R23 is run by hand at the end of the build with the development services up; the result is written in the pull request.
- No real address, account or password appears in a test or a fixture.

## Data safety
- The SMTP password is a secret of `.env`: `.env.example` holds it empty (TOKI-096 R9) and it is never logged, in a failure line either (R13).
- A code is a credential. It is in the mail and in memory for the send only; it is not in the log, not in the subject (a subject shows in notification lists and in the logs of mail servers) and not in an error (R7, R13, R14).
- A recipient address and the `joinUrl` are personal data or carry a token; neither is logged (R13).
- The mail travels over TLS in production (R4). The certificate is checked and nothing switches the check off.
- The HTML part makes no request to an outside address, so opening the mail tells nobody that it was opened (R11).
- Text from a person (a workspace name, a display name) cannot become markup or a header (R12).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Phase 1 sends through configurable SMTP (D-027) | R2, R5; the `mail` area and Nodemailer in Layout. |
| Development uses Mailpit | R23; `SMTP_*` development values in "Configuration". |
| The sign-in mail carries the code only, no button (D-157) | R7, R8. |
| The invitation mail names the workspace and the inviter, has a Join button and a 6-digit code; the link alone signs nobody in (D-037, D-149) | R9, R10; the sign-in rules are TOKI-097's. |
| A code is valid for 10 minutes, the invitation's included (D-136) | R7, R9; the constant pinned in "What each mail says". The lifetime itself is enforced by TOKI-022. |
| Invitations in English, sign-in mail in the member's language (D-180) | R6, R8, R10. |
| Batch limited to 50 addresses (D-134) | The limit and the batch are TOKI-024's; this layer keeps at most 2 connections (R19) so a batch does not open 50. |
| When mail fails halfway, the sent invitations stay and failed rows read "Mail not sent" with Resend (D-099) | R6, R16: the layer returns a result per mail and never throws, so the caller can report each row; the rows are TOKI-024's. |
| Every text through `i18n`, English and Vietnamese, CI fails on a missing translation (D-018, D-064) | R22. |
| Wording the prototype lacks is a proposal (D-139) | "What each mail says" and concern 3. |
| Needs TOKI-004, TOKI-017, TOKI-096 and TOKI-003; size M, milestone M2 | R2, R3, R20, R21 use TOKI-004; R22 uses TOKI-017; R2 uses TOKI-096; R23 uses TOKI-003. |
| Secrets live in `.env`, never in git | R2, Data safety. |

## Open questions from the intent
- In which language is each mail sent? Answered by D-180 (Confirmed in the decision log): the invitation in English, the sign-in mail in the language the member chose (R6, R10). Recorded: an earlier planning note marked it Open; the log wins.
- What happens when a sign-in mail cannot be sent? Not answered. Carried forward as concern 1. For an invitation it is answered by D-099 and belongs to TOKI-024; this layer reports each result (R6).
- Which SMTP account and sender address does production use? Not answered. Carried forward as concern 2.
- What do the mails say, word for word? Not answered: only proposals exist (D-139). Carried forward as concern 3, with the Vietnamese form of address as concern 4.
- Are failed mails retried? Answered in this spec: not by this layer (R17); retries belong to the job queue, which TOKI-064 decides (concern 5).

## Areas of concern
1. What a person reads when a sign-in mail cannot be sent is not decided. D-099 covers invitations only. The sign-in API keeps the person unaware, so that the page never shows which addresses are members (its R8, its concern 2). This layer reports the failure and logs it (R14); it does not decide what is shown. Proposal, not a decision: as in the sign-in API spec, no message to the person, "Resend code" after 60 seconds, and the emergency link of TOKI-026 for the operator when mail stays down. Owner: Thanh Truong.
2. The SMTP account that sends mail in production, and the sender address, are not decided. The Blueprint suggests a company Google account only (requirement NFR-12, "which account: still open"; TOKI-096 concern 1). This work reads the account from `SMTP_*` and `MAIL_FROM_ADDRESS` (R2) and is complete without it, but sign-in does not work in production until it is chosen, and a Google account has its own sending limit (the reason for D-134). Not decided. Owner: Thanh Truong.
3. The wording of both mails in English and Vietnamese, the subjects and the sender name are not decided. Every one is a proposal (D-139); the sender name default `Toki` and the Vietnamese "Gửi lại mã" that must match the button of TOKI-023 are proposals too. The build uses the table of "What each mail says"; a different wording changes the catalogs only. Not decided. Owner: Thanh Truong.
4. The Vietnamese form of address is not decided (D-188, Open; proposal: "bạn" everywhere). The Vietnamese sign-in mail uses it. Not decided. Owner: Thanh Truong.
5. Decided in this spec: the layer makes one attempt and does not retry (R17), and the caller is told at once. Reason: a retry after a timeout can send the same code twice, and an invitation batch of 50 would wait on a dead mail server; the person has Resend (D-082, D-099) and the operator has the emergency link (D-159). The retry count and delay of mail sent from the job queue belong to the spec of TOKI-064, which this spec does not constrain. Owner: Thanh Truong.
6. Decided in this spec: the names and flags of the seven variables and `SMTP_TLS`'s default and production rule (R2 to R4), because TOKI-096 names a category and no variable. If the TOKI-096 inventory already carries equivalent rows when this is built, its names win and this spec's wording follows; TOKI-096 R10 and concern 10 give the build that right. Owner: Thanh Truong.
7. Decided in this spec: the client is Nodemailer with a pool of at most 2 connections, 10-second socket limits and a 30-second whole-send limit (R15, R19); no code in the subject; no recipient address in the log (Design). Reason for each is in Design and Data safety. Owner: Thanh Truong.
8. Decided in this spec: the mail layer holds `{minutes}` 10 and `{days}` 7 as constants of its own, pinned by a test to D-136 and D-037, because the sign-in API calls the layer with the address, the code and the language only. Hand-off: if TOKI-022 or TOKI-024 exposes the lifetimes as shared constants, the layer reads them instead and the pinning test follows. Owner: Thanh Truong.
9. Decided in this spec: `buildApp` gets the optional input `mail` and the layer is `app.mail` (R21), so the modules that send mail get one seam for tests. TOKI-022 and TOKI-024 call `app.mail`; this changes TOKI-004's `buildApp` by one optional input and nothing else. Owner: Thanh Truong.
10. Decided in this spec: the Join address is received from the caller and never built here (R9, Scope). The page behind it, its token and its refusal pages are TOKI-097's (D-081, D-149); the creation of the invitation and of the address is TOKI-024's. Answered with D-149: the address alone signs nobody in, so this layer needs no knowledge of the token. Owner: Thanh Truong.
